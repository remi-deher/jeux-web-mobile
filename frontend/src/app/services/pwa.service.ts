import { Injectable, signal, computed } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class PwaService {
  private deferredPrompt = signal<any>(null);
  private isPlatformIOS = signal<boolean>(false);
  private isAppStandalone = signal<boolean>(false);
  private isDismissed = signal<boolean>(false);

  // Checks if beforeinstallprompt was fired (Android/PC)
  isInstallable = computed(() => this.deferredPrompt() !== null);
  isIOS = computed(() => this.isPlatformIOS());
  isStandalone = computed(() => this.isAppStandalone());
  
  // Decide whether to show the banner
  showBanner = computed(() => {
    // If already installed, don't show
    if (this.isAppStandalone()) return false;
    // If muted/dismissed, don't show
    if (this.isDismissed()) return false;
    // Show if it is installable (Chrome/Android/PC) OR if it is iOS
    return this.isInstallable() || this.isPlatformIOS();
  });

  constructor() {
    this.checkStandalone();
    this.checkIOS();
    this.checkDismissal();
    this.initInstallPromptListener();
  }

  private checkStandalone() {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                         (window.navigator as any).standalone === true;
    this.isAppStandalone.set(isStandalone);
  }

  private checkIOS() {
    const ua = window.navigator.userAgent;
    const hasTouch = 'maxTouchPoints' in window.navigator && window.navigator.maxTouchPoints > 0;
    const isIOSPlatform = /iPad|iPhone|iPod/.test(ua) || 
                          (/Macintosh/.test(ua) && hasTouch); // iPadOS 13+ reports as Macintosh
    this.isPlatformIOS.set(isIOSPlatform);
  }

  private checkDismissal() {
    const dismissedTime = localStorage.getItem('pwa_install_prompt_dismissed');
    if (dismissedTime) {
      const diff = Date.now() - parseInt(dismissedTime, 10);
      const days = diff / (1000 * 60 * 60 * 24);
      if (days < 7) {
        this.isDismissed.set(true);
      } else {
        localStorage.removeItem('pwa_install_prompt_dismissed');
      }
    }
  }

  private initInstallPromptListener() {
    window.addEventListener('beforeinstallprompt', (e: any) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later.
      this.deferredPrompt.set(e);
    });

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      this.isAppStandalone.set(true);
      this.deferredPrompt.set(null);
      console.log('PWA was installed successfully');
    });
  }

  async promptInstall(): Promise<boolean> {
    const promptEvent = this.deferredPrompt();
    if (!promptEvent) return false;

    // Show the install prompt
    promptEvent.prompt();
    
    // Wait for the user to respond to the prompt
    const { outcome } = await promptEvent.userChoice;
    console.log(`User response to the install prompt: ${outcome}`);
    
    // We've used the prompt, and can't use it again
    this.deferredPrompt.set(null);
    return outcome === 'accepted';
  }

  dismissBanner() {
    localStorage.setItem('pwa_install_prompt_dismissed', Date.now().toString());
    this.isDismissed.set(true);
  }

  resetDismissal() {
    localStorage.removeItem('pwa_install_prompt_dismissed');
    this.isDismissed.set(false);
  }
}
