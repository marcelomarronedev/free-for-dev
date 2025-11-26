
interface FeedItem {
  title: string;
  link: string;
  imageUrl: string;
  pubDate: string;
  votes?: number;
}

interface SimpleFeed {
  code: string;
  name: string;
  url: string;
  defaultImage: string;
}

declare const Swal: any;

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 5000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];

    if (ch === '"' && line[i + 1] === '"') {
      // escaped quote -> append one quote and skip next
      current += '"';
      i++;
    } else if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current);
  return result.map(s => s.trim());
}



export function validarImagen(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    if (!url) return resolve(false);
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = `${url}?_=${Date.now()}`;
  });
}

async function fetchFeedsList(): Promise<SimpleFeed[]> {
  const remote = "https://corsproxy.io/?https://free-for-dev.alwaysdata.net/feeds.txt";
  const resp = await fetchWithTimeout(remote, { cache: "no-store" }, 7000);
  if (!resp || !resp.ok) throw new Error("Cannot load feeds.txt");
  const txt = await resp.text();
  const lines = txt.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));

  const feeds: SimpleFeed[] = lines.map(line => {
    const parts = parseCSVLine(line);
    return {
      code: parts[0] ?? "",
      name: parts[1] ?? parts[1] ?? "",
      url: parts[2] ?? "",
      defaultImage: parts[3] ?? ""
    };
  }).filter(f => f.code && f.url && f.name);

  return feeds;
}

async function getFeedItems(feedUrl: string): Promise<FeedItem[]> {
  try {
    const resp = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(feedUrl)}`, { cache: "no-store" }, 7000);
    if (!resp || !resp.ok) {
      console.warn("Feed ignored (http error):", resp?.status, feedUrl);
      return [];
    }
    const xmlText = await resp.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");

    const itemNodes = Array.from(xml.querySelectorAll("item"));
    const items: FeedItem[] = itemNodes.map(item => {
      const title = item.querySelector("title")?.textContent?.trim() ?? "";
      const link = item.querySelector("link")?.textContent?.trim() ?? (item.querySelector("guid")?.textContent?.trim() ?? "");
      
      // enclosure or media:content
      const enclosure = item.querySelector("enclosure") as Element | null;
      const media = item.querySelector("media\\:content, media\\:thumbnail") as Element | null;
      let imageUrl = enclosure?.getAttribute("url") ?? media?.getAttribute("url") ?? "";

      // If still empty, don't try to parse description for image per your new spec.
      const pubDate = "";

      return { title, link, imageUrl, pubDate };
    });

    return items;
  } catch (err) {
    console.error("Error reading feed:", feedUrl, err);
    return [];
  }
}

function makeSelectOption(feed: SimpleFeed) {
  const opt = document.createElement("option");
  opt.value = feed.code;
  opt.textContent = feed.name;
  return opt;
}

function renderItemsGrid(items: FeedItem[], defaultImage: string, container: HTMLElement, selectedFeeed: SimpleFeed) {
  container.innerHTML = ""; 

  if (!items || items.length === 0) {
    container.innerHTML = `<p style="text-align:center; font-weight:bold; margin-top:20px;">${t("noFeeds")}</p>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  let row: HTMLDivElement | null = null;

  items.forEach((item, idx) => {
    if (idx % 3 === 0) {
      row = document.createElement("div");
      row.className = "row mb-4";
      fragment.appendChild(row);
    }

    if (!item) return;

    const col = document.createElement("div");
    col.className = "col-md-4";

    const card = document.createElement("div");
    card.className = "card h-100 shadow-sm";

    const imgLink = document.createElement("a");
    imgLink.href = item.link || "#";
    imgLink.target = "_blank";
    imgLink.rel = "noopener noreferrer";
    
    const img = document.createElement("img");
    img.alt = item.title ?? "";
    img.src = defaultImage || "https://free-for-dev.rebuscando.info/img/logo.png";
    
    img.style.borderRadius = "8px";
    img.style.border = "1px solid #ccc";
    img.style.height = "200px"; 
    img.style.width = "100%";
    img.style.objectFit = "cover";
    
    imgLink.appendChild(img);
    
    (async () => {
      try {
        const candidate = item.imageUrl ?? "";
        if (candidate) {
          const ok = await validarImagen(candidate);
          img.src = ok ? candidate : (defaultImage || "https://free-for-dev.rebuscando.info/img/logo.png");
        } else {
          img.src = defaultImage || "https://free-for-dev.rebuscando.info/img/logo.png";
        }
      } catch (e) {
        img.src = defaultImage || "https://free-for-dev.rebuscando.info/img/logo.png";
      }
    })();
    
    card.appendChild(imgLink);
    
    const cardBody = document.createElement("div");
    cardBody.className = "card-body";
    
    const titleA = document.createElement("a");
    titleA.href = item.link || "#";
    titleA.target = "_blank";
    titleA.rel = "noopener noreferrer";
    titleA.textContent = item.title || t("feedTechnicalIssues");
    titleA.style.display = "block";
    titleA.style.marginBottom = "10px";
    titleA.style.marginTop = "10px";
    titleA.style.fontSize = "16px";
   
    
    cardBody.appendChild(titleA);


    const actionsSpan = document.createElement("div");
    actionsSpan.style.marginBottom = "10px";
    
    const voteBtn = document.createElement("span");
    voteBtn.style.cursor = "pointer";
    voteBtn.style.marginRight = "8px";
    voteBtn.title = t("voteThisFeed");
    voteBtn.textContent = "👍";
    voteBtn.style.fontSize = "16px";
    
    const votesSpan = document.createElement("span");
    votesSpan.className = "votes-count";
    votesSpan.style.fontSize = "14px";
    votesSpan.style.color = "gray";
    votesSpan.style.marginLeft = "0px";
    votesSpan.textContent = `(${item.votes ?? 0} ${t("votes")})`;
    
    voteBtn.addEventListener("click", async () => {
      try {
        const token = await new Promise<string>((resolve, reject) => {
          if (!(window as any).grecaptcha) return reject("reCAPTCHA not loaded");
          (window as any).grecaptcha.ready(() => {
            (window as any).grecaptcha.execute("6LfbFhcsAAAAACjeQU-G9iCrhhOFi_U02Pt_3xNt", { action: "vote" })
              .then((token: string) => token ? resolve(token) : reject("Invalid token"));
          });
        });
    
        const category = (document.getElementById("categorySelect") as HTMLSelectElement).value;
    
        const response = await fetch("https://free-for-dev.alwaysdata.net/vote.php", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            feed: item.link,
            cat: category,
            captchatoken: token
          })
        });
    
        if (response.status === 429) { Swal.fire({ icon: "warning", title: "Ups!", text: t("voteTooMany") }); return; }
        if (response.status === 409) { Swal.fire({ icon: "info", title: "Ups!", text: t("voteDuplicate") }); return; }
    
        if (response.ok) {
          const data = await response.json();
          if (data.success) {
            item.votes = data.votes;
            votesSpan.textContent = `(${item.votes} ${t("votes")})`;
            Swal.fire({ icon: "success", title: "OK!", text: t("voteThanks"), timer: 2000, showConfirmButton: false });
          } else {
            Swal.fire({ icon: "error", title: "Ups!", text: t("voteError") });
          }
        } else {
          Swal.fire({ icon: "error", title: "Ups!", text: t("voteError") + " " + response.status });
        }
      } catch (err) {
        console.error(t("voteError"), err);
        Swal.fire({ icon: "error", title: "Ups!", text: t("voteError") });
      }
    });
    
    actionsSpan.appendChild(voteBtn);
    actionsSpan.appendChild(votesSpan);
    
    const shareBtn = document.createElement("span");
    shareBtn.className = "share";
    shareBtn.style.cursor = "pointer";
    shareBtn.style.marginLeft = "10px";
    shareBtn.textContent = "🔗";
    shareBtn.title = t("sharethisnews");
    shareBtn.style.fontSize = "16px";

    shareBtn.addEventListener("click", () => {
      if (!navigator.share) {
        Swal.fire({ icon: "warning", title: "Ups!", text: t("shareFailed") });
        return;
      }
      navigator.share({
        title: selectedFeeed.name,
        text: item.title,
        url: item.link
      })
      .then(() => console.log("shared!"))
      .catch(() => Swal.fire({ icon: "error", title: "Ups!", text: t("shareError") }));
    });
    
    actionsSpan.appendChild(shareBtn);
    
    cardBody.appendChild(actionsSpan);





const commentsToggle = document.createElement("a");
commentsToggle.href = "#";
commentsToggle.textContent = t("commentsToggle");
commentsToggle.style.display = "inline-block";
commentsToggle.style.marginTop = "10px";
commentsToggle.style.marginBottom = "10px";
commentsToggle.style.cursor = "pointer";

const commentsDiv = document.createElement("div");
commentsDiv.style.display = "none";
commentsDiv.style.height = "300px";         
commentsDiv.style.overflowY = "auto";       
commentsDiv.style.marginTop = "10px";
commentsDiv.style.border = "1px solid #ccc";
commentsDiv.style.padding = "10px";
commentsDiv.style.borderRadius = "8px";

commentsToggle.addEventListener("click", (e) => {
  e.preventDefault();
  if (commentsDiv.style.display === "none") {
    commentsDiv.style.display = "block";
    commentsDiv.style.marginBottom = "20px";
    
    if (!commentsDiv.hasChildNodes()) {
      const script = document.createElement("script");
      script.src = "https://utteranc.es/client.js";
      script.async = true;
      script.setAttribute("repo", "marcelomarronedev/free-for-dev");
      script.setAttribute("issue-term", item.link); 
      script.setAttribute("theme", "github-light");
      script.setAttribute("crossorigin", "anonymous");
      commentsDiv.appendChild(script);
    }
  } else {
    commentsDiv.style.display = "none";
    
  }
});

cardBody.appendChild(commentsToggle);
cardBody.appendChild(commentsDiv);


card.appendChild(cardBody);
    col.appendChild(card);

    if (row) row.appendChild(col);
  });

  container.appendChild(fragment);
}


function getSelectedCatFromUrl(): string {
  const params = new URLSearchParams(window.location.search);
  return params.get("cat") ?? "001";
}

function setSelectedCatInUrl(code: string) {
  const url = new URL(window.location.href);
  url.searchParams.set("cat", code);
  history.replaceState(null, "", url.toString());
}

async function initFeedsModule() {
  try {
    const container = document.getElementById("feeds-container");
    if (!container) {
      console.warn("No #feeds-container found in DOM");
      return;
    }
    const loadingEl = document.getElementById("loading-container");
    const selectEl = document.getElementById("categorySelect") as HTMLSelectElement | null;
    if (!selectEl) {
      console.warn("No #categorySelect found in DOM");
      return;
    }

    if (loadingEl) loadingEl.style.display = "block";

    const feeds = await fetchFeedsList();

    selectEl.innerHTML = "";
    feeds.forEach(feed => selectEl.appendChild(makeSelectOption(feed)));

    const defaultCat = getSelectedCatFromUrl();
    let selectedCat = feeds.some(f => f.code === defaultCat) ? defaultCat : (feeds[0]?.code ?? "001");
    selectEl.value = selectedCat;

    const selectedFeed = feeds.find(f => f.code === selectedCat);
    if (selectedFeed) 
    {
      const items = await getFeedItems(selectedFeed.url);

      const votesMap = await fetchVotes(selectedFeed.code);

      items.forEach(item => {
        const key = item.link.trim().toLowerCase();
        (item as any).votes = votesMap[key] ?? 0;
      });
      items.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));

      container.style.display = "block";
      renderItemsGrid(items, selectedFeed.defaultImage, container, selectedFeed);
    }
    else 
    {
      container.innerHTML = `<p style="text-align:center; font-weight:bold; margin-top:20px;">${t("noFeeds")}</p>`;
    }

    const catTitleEl = document.getElementById("cattitle");
    if (catTitleEl && selectedFeed) {
      catTitleEl.textContent = `Free resources for developers: ${selectedFeed.name}`;
    }

    if (loadingEl) loadingEl.style.display = "none";





    selectEl.addEventListener("change", async () => {
      const code = selectEl.value;
      setSelectedCatInUrl(code);

      const feed = feeds.find(f => f.code === code);

      if (catTitleEl && feed) {
        catTitleEl.textContent = `Free resources for developers: ${feed.name}`;
      }

      if (!feed) {
        container.innerHTML = `<p style="text-align:center; font-weight:bold; margin-top:20px;">${t("noFeeds")}</p>`;
        return;
      }

      if (catTitleEl && feed) {
  catTitleEl.textContent = `Free resources for developers: ${feed.name}`;
}

      if (loadingEl) loadingEl.style.display = "block";
      const items = await getFeedItems(feed.url);

      const votesMap = await fetchVotes(feed.code);

      items.forEach(item => {
        const key = item.title.trim().toLowerCase();
        (item as any).votes = votesMap[key] ?? 0;
      });
      items.sort((a, b) => (b.votes ?? 0) - (a.votes ?? 0));


      container.style.display = "block";
      renderItemsGrid(items, feed.defaultImage, container, feed);
      if (loadingEl) loadingEl.style.display = "none";
      
      /* Scroll to container smoothly
      setTimeout(() => {
        const rect = container.getBoundingClientRect();
        window.scrollTo({ top: window.scrollY + rect.top - 90, behavior: "smooth" });
      }, 120);*/

    });

  } catch (err) {
    console.error("initFeedsModule error:", err);
    const loadingEl = document.getElementById("loading-container");
    if (loadingEl) loadingEl.style.display = "none";
    const container = document.getElementById("feeds-container");
    if (container) container.innerHTML = `<p style="text-align:center; font-weight:bold; margin-top:20px;">${t("connectionError")}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initFeedsModule();

  //Collapsable menu
  const navbarCollapse = document.querySelector(".navbar-ex1-collapse");

  function closeNavbar() {
    if (navbarCollapse && navbarCollapse.classList.contains("in")) {
      const toggleButton = document.querySelector(".navbar-toggle") as HTMLButtonElement | null;;
      if (toggleButton) toggleButton.click();
    }
  }

  const navLinks = document.querySelectorAll(".navbar-ex1-collapse a");
  navLinks.forEach(link => {
    link.addEventListener("click", closeNavbar);
  });

  const categorySelect = document.getElementById("categorySelect") as HTMLSelectElement | null;
  categorySelect?.addEventListener("change", () => {
    closeNavbar();
    window.scrollTo({ top: 0, behavior: "smooth" }); 
  });


  
});

const i18n = {
  en: {
    noFeeds: "No resources match the selected filters.",
    connectionError: "Connection error.",
    voteThanks: "Thank you! Your vote has been counted.",
    voteDuplicate: "You have already voted from this IP.",
    voteTooMany: "Too many requests from this network. Try later.",
    voteError: "Could not register your vote.",
    shareError: "Cannot share this resource.",
    shareFailed: "Could not share the resource.",
    sharethisnews: "Share this resource",
    voteThisFeed: "Vote this this free resource",
    commentsToggle: "🗨️ Comments on this free resource",
    feedTechnicalIssues: "This feed is experiencing technical issues",
    votes: "votes"
  }
};


function t(key: keyof typeof i18n["en"]): string {
  const lang = ((window as any).PAGE_LANG || "en") as keyof typeof i18n;
  if (!i18n[lang]) return key;
  return i18n[lang][key] ?? key;
}

async function fetchVotes(categoryCode: string): Promise<Record<string, number>> {
  try {
    const resp = await fetch(`https://free-for-dev.alwaysdata.net/getvotes.php?&cat=${encodeURIComponent(categoryCode)}&nocache=${Date.now()}`, {
      cache: "no-store"
    });
    if (!resp.ok) {
      console.warn("Error getting votes. Status:", resp.status);
      return {};
    }
    const votesData: Array<{ feed: string; votes: number }> = await resp.json();
    const votesMap: Record<string, number> = {};
    votesData.forEach(v => {
      votesMap[v.feed.trim().toLowerCase()] = v.votes;
    });
    return votesMap;
  } catch (err) {
    console.error("Error getting votes:", err);
    return {};
  }
}
