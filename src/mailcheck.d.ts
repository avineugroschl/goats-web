declare module "mailcheck" {
  interface Suggestion {
    address: string;
    domain: string;
    full: string;
  }
  interface RunOptions {
    email: string;
    suggested: (suggestion: Suggestion) => void;
    empty: () => void;
    domains?: string[];
    secondLevelDomains?: string[];
    topLevelDomains?: string[];
  }
  const Mailcheck: {
    run: (opts: RunOptions) => void;
  };
  export = Mailcheck;
}

declare module "disposable-email-domains" {
  const domains: string[];
  export default domains;
}
