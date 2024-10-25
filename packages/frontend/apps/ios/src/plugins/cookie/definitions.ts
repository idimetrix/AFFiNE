export interface CookiePlugin {
  /**
   * Returns the screen's current orientation.
   */
  getCookies(options: { url: string }): Promise<Record<string, string>>;
}
