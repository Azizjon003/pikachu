import axios, { AxiosResponse } from "axios";

class BingLinks {
  private query: string;
  private limit: number;
  private adult: string;
  private timeout: number;
  private filter: string;
  private blockedSites: string[];
  private verbose: boolean;
  private pageCounter: number;
  private seen: Set<string>;
  private headers: Record<string, string>;

  constructor(
    query: string,
    limit: number,
    adult: string = "off",
    timeout: number = 10,
    filter: string = "",
    blockedSites: string[] = [],
    verbose: boolean = true
  ) {
    this.query = query;
    this.limit = limit;
    this.adult = adult;
    this.timeout = timeout;
    this.filter = filter;
    this.blockedSites = blockedSites;
    this.verbose = verbose;

    this.pageCounter = 0;
    this.seen = new Set<string>();
    this.headers = {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 " +
        "(KHTML, like Gecko) Chrome/39.0.2171.95 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.8",
      Connection: "keep-alive",
    };
  }

  private getFilter(shorthand: string): string {
    switch (shorthand) {
      case "line":
      case "linedrawing":
        return "+filterui:photo-linedrawing";
      case "photo":
        return "+filterui:photo-photo";
      case "clipart":
        return "+filterui:photo-clipart";
      case "gif":
      case "animatedgif":
        return "+filterui:photo-animatedgif";
      case "transparent":
        return "+filterui:photo-transparent";
      default:
        return shorthand || "";
    }
  }

  async getImageLinks(): Promise<string[]> {
    const results: string[] = [];

    while (results.length < this.limit) {
      const filterStr = this.getFilter(this.filter);
      const encodedQuery = encodeURIComponent(this.query);
      const requestUrl =
        `https://www.bing.com/images/async?q=${encodedQuery}` +
        `&first=${this.pageCounter}&count=${this.limit}&adlt=${this.adult}&qft=${filterStr}`;

      if (this.verbose) {
        console.log(`\n[🔎] Fetching page ${this.pageCounter + 1}`);
      }

      const res: AxiosResponse<string> = await axios.get<string>(requestUrl, {
        headers: this.headers,
        timeout: this.timeout * 1000,
      });

      const html: string = res.data;
      const matches = [...html.matchAll(/murl&quot;:&quot;(.*?)&quot;/g)];
      const links: string[] = matches.map((m) => m[1]);

      if (links.length === 0) {
        break;
      }

      for (const link of links) {
        if (results.length >= this.limit) break;
        if (
          !this.seen.has(link) &&
          !this.blockedSites.some((site) => link.includes(site))
        ) {
          this.seen.add(link);
          results.push(link);
        }
      }

      this.pageCounter += 1;
    }

    return results;
  }
}

export default BingLinks;
