import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface UserStats {
  wins: number;
  losses: number;
  draws: number;
}

export interface User {
  username: string;
  pinHash: string | null; // null pour les comptes temporaires persistés si besoin (ou on ne les persiste pas en base)
  salt: string | null;
  tokenHash: string | null; // pour la connexion auto sans PIN
  stats: { [gameType: string]: UserStats };
  friends?: string[];
  createdAt: number;
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

// Base de données des utilisateurs chargée en mémoire
let users: { [username: string]: User } = {};

// Tentatives de login échouées pour limiter le brute-force
// { [username_ou_ip]: { count: number, lockUntil: number } }
const loginAttempts: { [key: string]: { count: number; lockUntil: number } } = {};

// Charger les utilisateurs au démarrage
export function loadUsers() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      users = JSON.parse(data);
      console.log(`Loaded ${Object.keys(users).length} registered users from ${USERS_FILE}`);
    } else {
      users = {};
      saveUsers();
    }
  } catch (err) {
    console.error('Error loading users.json:', err);
    users = {};
  }
}

// Sauvegarder les utilisateurs sur le disque
export function saveUsers() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving users.json:', err);
  }
}

// Hachage sécurisé du PIN avec PBKDF2
export function hashPin(pin: string, salt: string): string {
  return crypto.pbkdf2Sync(pin, salt, 1000, 64, 'sha512').toString('hex');
}

export function generateSalt(): string {
  return crypto.randomBytes(16).toString('hex');
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString('hex');
}

// Vérifier si un pseudo est valide
export function isValidUsername(username: string): boolean {
  const clean = username.trim();
  if (clean.length < 3 || clean.length > 15) return false;
  // Alphanumérique, tirets, underscores
  return /^[a-zA-Z0-9_\-]+$/.test(clean);
}

// Obtenir le statut d'un pseudo
export function checkUserStatus(username: string): { exists: boolean; requiresPin: boolean } {
  const key = username.trim().toLowerCase();
  const user = users[key];
  if (!user) {
    return { exists: false, requiresPin: false };
  }
  return { exists: true, requiresPin: user.pinHash !== null };
}

// Bloquer les brute force
function isLocked(key: string): { locked: boolean; remainingSeconds: number } {
  const attempts = loginAttempts[key];
  if (!attempts) return { locked: false, remainingSeconds: 0 };
  
  const now = Date.now();
  if (attempts.lockUntil > now) {
    return { locked: true, remainingSeconds: Math.ceil((attempts.lockUntil - now) / 1000) };
  }
  return { locked: false, remainingSeconds: 0 };
}

function registerAttempt(key: string, success: boolean) {
  if (success) {
    delete loginAttempts[key];
    return;
  }
  
  if (!loginAttempts[key]) {
    loginAttempts[key] = { count: 0, lockUntil: 0 };
  }
  
  const attempts = loginAttempts[key];
  attempts.count += 1;
  
  if (attempts.count >= 5) {
    // Bloquer pendant 5 minutes après 5 échecs
    attempts.lockUntil = Date.now() + 5 * 60 * 1000;
  }
}

// Créer ou enregistrer un utilisateur
export function registerUser(
  username: string,
  pin: string | null
): { success: boolean; token?: string; message?: string; user?: User; friends?: string[] } {
  const key = username.trim().toLowerCase();
  const cleanUsername = username.trim();

  if (!isValidUsername(cleanUsername)) {
    return { success: false, message: 'Pseudonyme invalide. (3-15 caract. alphanumériques, - ou _)' };
  }

  if (users[key]) {
    return { success: false, message: 'Ce pseudonyme est déjà pris.' };
  }

  let pinHash = null;
  let salt = null;
  let token = null;
  let tokenHash = null;

  if (pin !== null) {
    if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
      return { success: false, message: 'Le code PIN doit comporter entre 4 et 6 chiffres.' };
    }
    salt = generateSalt();
    pinHash = hashPin(pin, salt);
    token = generateToken();
    tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  }

  const newUser: User = {
    username: cleanUsername,
    pinHash,
    salt,
    tokenHash,
    stats: {},
    friends: [],
    createdAt: Date.now()
  };

  users[key] = newUser;
  
  // Si le compte a un PIN, on le persiste sur disque
  if (pin !== null) {
    saveUsers();
  }

  return { success: true, token: token ?? undefined, user: newUser, friends: newUser.friends };
}

// Sécuriser un compte existant temporaire en lui ajoutant un PIN
export function secureTempUser(
  username: string,
  pin: string
): { success: boolean; token?: string; message?: string } {
  const key = username.trim().toLowerCase();
  const user = users[key];

  if (!user) {
    // Si l'utilisateur n'existe pas en mémoire, on le crée
    return registerUser(username, pin);
  }

  if (user.pinHash !== null) {
    return { success: false, message: 'Ce compte est déjà sécurisé par un code PIN.' };
  }

  if (pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
    return { success: false, message: 'Le code PIN doit comporter entre 4 et 6 chiffres.' };
  }

  const salt = generateSalt();
  user.salt = salt;
  user.pinHash = hashPin(pin, salt);
  const token = generateToken();
  user.tokenHash = crypto.createHash('sha256').update(token).digest('hex');

  saveUsers();
  return { success: true, token };
}

// Authentifier avec PIN
export function loginUser(
  username: string,
  pin: string
): { success: boolean; token?: string; message?: string; stats?: any; friends?: string[] } {
  const key = username.trim().toLowerCase();
  const user = users[key];

  const lockCheck = isLocked(key);
  if (lockCheck.locked) {
    return { 
      success: false, 
      message: `Trop de tentatives. Compte bloqué. Réessayez dans ${lockCheck.remainingSeconds}s.` 
    };
  }

  if (!user || user.pinHash === null || user.salt === null) {
    return { success: false, message: 'Pseudonyme ou code PIN incorrect.' };
  }

  const hashed = hashPin(pin, user.salt);
  if (hashed !== user.pinHash) {
    registerAttempt(key, false);
    return { success: false, message: 'Pseudonyme ou code PIN incorrect.' };
  }

  // Connexion réussie, réinitialiser tentatives et générer token
  registerAttempt(key, true);
  const token = generateToken();
  user.tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  saveUsers();

  return { success: true, token, stats: user.stats, friends: user.friends || [] };
}

// Connexion automatique par Token
export function loginWithToken(
  username: string,
  token: string
): { success: boolean; stats?: any; friends?: string[]; message?: string } {
  const key = username.trim().toLowerCase();
  const user = users[key];

  if (!user || user.tokenHash === null) {
    return { success: false, message: 'Session invalide.' };
  }

  const hashed = crypto.createHash('sha256').update(token).digest('hex');
  if (hashed !== user.tokenHash) {
    return { success: false, message: 'Session expirée ou invalide.' };
  }

  return { success: true, stats: user.stats, friends: user.friends || [] };
}

// Incrémenter les victoires / défaites d'un jeu
export function incrementUserStats(
  username: string,
  gameType: string,
  result: 'win' | 'loss' | 'draw'
): { wins: number; losses: number; draws: number } | null {
  const key = username.trim().toLowerCase();
  const user = users[key];
  if (!user) return null;

  if (!user.stats[gameType]) {
    user.stats[gameType] = { wins: 0, losses: 0, draws: 0 };
  }

  const stat = user.stats[gameType];
  if (result === 'win') stat.wins += 1;
  else if (result === 'loss') stat.losses += 1;
  else if (result === 'draw') stat.draws += 1;

  // On sauvegarde uniquement si l'utilisateur est enregistré
  if (user.pinHash !== null) {
    saveUsers();
  }

  return stat;
}

// Obtenir les stats d'un utilisateur
export function getUserStats(username: string): { [gameType: string]: UserStats } | null {
  const key = username.trim().toLowerCase();
  const user = users[key];
  return user ? user.stats : null;
}

// Synchroniser la liste des amis
export function syncUserFriends(
  username: string,
  friendsList: string[]
): { success: boolean; message?: string } {
  const key = username.trim().toLowerCase();
  const user = users[key];
  if (!user) {
    return { success: false, message: 'Utilisateur introuvable.' };
  }
  user.friends = friendsList;
  if (user.pinHash !== null) {
    saveUsers();
  }
  return { success: true };
}
