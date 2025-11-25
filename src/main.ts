interface FeedItem {
  title: string;
  link: string;
  imageUrl: string;
  pubDate: string; 
  votes?: number;
}


interface FeedHistoryItem {
  link: string;
  host: string;
  title: string;
  imageUrl: string;
  pubDate: string;
  type: string; // RSS o ATOM
  fromDescription?: boolean; // indica si la imagen viene de <description>
}


interface CategoryData {
  code: string;
  name: string;
  description: string;
  subdescription: string;
  countryCode: string;
  countryName: string;
  languageCode: string;
  languageName: string;
}

declare const Swal: any;

let allCategories: CategoryData[] = []; 

let firstLoad = true; 

async function getFirstItem(feedUrl: string, type: string, useDescriptionForImage = false): Promise<FeedItem | null> {
  try {
    const response = await fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(feedUrl)}`, { cache: "no-store" });
    const isAtom = type === "atom";

    
    if (!response.ok) {
      if (response.status != 200) {
        console.warn(`Feed ignorado por error ${response.status}: ${feedUrl}`);
        return null;
      }
      throw new Error(`Error HTTP ${response.status}`);
    }

    const xmlText = await response.text();
    const parser = new DOMParser();
    const xml = parser.parseFromString(xmlText, "application/xml");

    let item: Element | null = isAtom ? xml.querySelector("entry") : xml.querySelector("item");
    if (!item) return null;

    const title = item.querySelector("title")?.textContent ?? "";

    let link = isAtom ? item.querySelector("link")?.getAttribute("href") ?? "" : item.querySelector("link")?.textContent ?? "";

    let imageUrl = "";

    if (isAtom) {
      const content = item.querySelector("content")?.textContent ?? "";
      const imgMatch = content.match(/<img[^>]+src=['"]([^'"]+)['"]/);
      if (imgMatch) imageUrl = imgMatch[1];
    } else {
      const media = item.querySelector("media\\:content, enclosure") as Element | null;
      if (media) imageUrl = media.getAttribute("url") ?? "";
    }

    
    if (!imageUrl && useDescriptionForImage) {
      const description = item.querySelector("description")?.textContent ?? "";
      const match = description.match(/<img[^>]+src=['"]([^'"]+)['"]/);
      if (match) imageUrl = match[1];
    }

   
    let pubDate = "";
    if (isAtom) {
      const updatedRaw = item.querySelector("updated")?.textContent ?? "";
      if (updatedRaw) pubDate = formatDate(new Date(updatedRaw));
    } else {
      const pubDateRaw = item.querySelector("pubDate")?.textContent ?? "";
      const pubDateObj = pubDateRaw ? new Date(pubDateRaw) : null;
      pubDate = pubDateObj ? formatDate(pubDateObj) : "";
    }

    console.log(JSON.stringify( { title, link, imageUrl, pubDate }));
    return { title, link, imageUrl, pubDate };

  } catch (error) {
    console.error("Error loading feed:", feedUrl, error);
    return null;
  }
}


function formatDate(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0");
  const day = pad(date.getDate());
  const month = pad(date.getMonth() + 1);
  const year = date.getFullYear();
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  const seconds = pad(date.getSeconds());
  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}


async function loadFeeds() {
  try {
    // Contenedor donde se generarán los feeds
    const container = document.getElementById("feeds-container");
    if (!container) return;

    const selectedCategory = (document.getElementById("categorySelect") as HTMLSelectElement)?.value;
    const selectedCountry = (document.getElementById("countrySelect") as HTMLSelectElement)?.value;
    const selectedLanguage = (document.getElementById("languageSelect") as HTMLSelectElement)?.value;


    container.style.display = "none";

    const loading = document.getElementById("loading-container");
    if (loading) loading.style.display = "block"; // mostrar spinner
    
   
    const feedsTxt = await fetchWithTimeout("https://corsproxy.io/?https://free-for-dev.alwaysdata.net/feeds.txt", { cache: "no-store" }).then(res => res.text());
    const lines = feedsTxt.split("\n").map(line => line.trim()).filter(line => line);

    let votesData: Array<{ feed: string; votes: number }> = [];
    try {
       const votesResponse = await fetch(`https://free-for-dev.alwaysdata.net/getvotes.php?language=${encodeURIComponent(selectedLanguage)}&cat=${encodeURIComponent(selectedCategory)}&country=${encodeURIComponent(selectedCountry)}&nocache=` + Date.now(), {
        cache: "no-store"
      });
      if (votesResponse.ok) {
        votesData = await votesResponse.json();
      } else {
        console.warn("No se pudo obtener la lista de votos. Status:", votesResponse.status);
      }
    } catch (err) {
      console.error("Error getting votes:", err);
    }

    let feedsWithImages = lines.map(line => {
      const parts = line.split(",");
      const [title, url, defaultImage, type, useDescription, category, country, language] = parts;
      const feedVotes = votesData.find(v => v.feed.trim().toLowerCase() === title.trim().toLowerCase());
      return {
        title: title?.trim(),
        url: url?.trim(),
        defaultImage: defaultImage?.trim() || "",
        type: (type || "rss").trim().toLowerCase(),
        useDescriptionForImage: useDescription?.trim().toLowerCase() === "true",
        category: category?.trim() || "",
        country: country?.trim() || "",
        language: language?.trim() || "",
        votes: feedVotes ? feedVotes.votes : 0
      };
    });


    
    feedsWithImages = feedsWithImages.filter(feed => {
      const matchCategory = !selectedCategory || feed.category === selectedCategory;
      const matchCountry = !selectedCountry || selectedCountry === "" || feed.country === selectedCountry;
      const matchLanguage = !selectedLanguage || feed.language === selectedLanguage;
      return matchCategory && matchCountry && matchLanguage;
    });

    if (!feedsWithImages || feedsWithImages.length === 0) {
      if (container) {
        container.innerHTML = `<p style="text-align:center; font-weight:bold; margin-top:20px;">${t("noFeeds")}</p>`;
        container.style.display = "block";  
      }
      if (loading) loading.style.display = "none";  // ocultar spinner
      return;
    }


    feedsWithImages.sort((a, b) => b.votes - a.votes);
  
    container.innerHTML = "";

    const itemsPerRow = 3;
    for (let i = 0; i < feedsWithImages.length; i += itemsPerRow) {
      const rowDiv = document.createElement("div");
      rowDiv.className = "row";

      for (let j = i; j < i + itemsPerRow && j < feedsWithImages.length; j++) {
        const feed = feedsWithImages[j];

        const colDiv = document.createElement("div");
        colDiv.className = "col-md-4 portfolio-item";
        colDiv.setAttribute("data-feed", String(j));

        colDiv.innerHTML = `
        <a target="_blank" href="#"><img class="img-responsive" src="#" onerror="this.onerror=null; this.src='https://marcelomarronedev.github.io/free-for-dev/img/logo.png';"></a>
        <h3>${feed.title} <span class="votes-count" style="font-size:14px; color:gray;">(${feed.votes} votos)</span></h3>
        <p><a target="_blank" href="##">...</a></p>
        <p class="pubdate"></p>
      `;
      

        rowDiv.appendChild(colDiv);
      }

      container.appendChild(rowDiv);
    }


   
    const items = await Promise.all(
      feedsWithImages.map(feed =>  getFirstItem(feed.url, feed.type, feed.useDescriptionForImage))  
    );

    // Actualizar contenido de cada feed
    items.forEach((feedItem, index) => 
    {
      const container = document.querySelector(`.portfolio-item[data-feed="${index}"]`) as HTMLElement | null;
      if (!container) return;
      
      if (!feedItem) {
        const feed = feedsWithImages[index];
      
        const linkEl = container.querySelector("a") as HTMLAnchorElement;
        const imgEl = container.querySelector("img") as HTMLImageElement;
        const titleEl = container.querySelector("p a") as HTMLAnchorElement;
        const pubDateEl = container.querySelector("p.pubdate") as HTMLParagraphElement;
      
        if (linkEl) linkEl.href = "#";
        if (imgEl) imgEl.src = "https://github.com/marcelomarronedev/free-for-dev/img/carta-ajuste.png";
        if (titleEl) {
          titleEl.textContent = t("feedTechnicalIssues"); 
          titleEl.href = "#";
        }
        if (pubDateEl) pubDateEl.textContent = "";
      
        const h3El = container.querySelector("h3");
        if (h3El) h3El.textContent = feed.title; 
        return; 
      }
      
      const feed = feedsWithImages[index];

      const linkEl = container.querySelector("a") as HTMLAnchorElement;
      const imgEl = container.querySelector("img") as HTMLImageElement;
      const titleEl = container.querySelector("p a") as HTMLAnchorElement;
      const pubDateEl = container.querySelector("p.pubdate") as HTMLParagraphElement;

      validarImagen(feedItem.imageUrl).then(esValida => {
        const finalImage = esValida ? feedItem.imageUrl : feed.defaultImage;
        if (linkEl) linkEl.href = feedItem.link;
        if (imgEl) imgEl.src = finalImage;
        if (titleEl) {
          titleEl.textContent = feedItem.title;
          titleEl.href = feedItem.link;
        }
        if (pubDateEl) pubDateEl.textContent = feedItem.pubDate;
      });
   

const commentsToggle = document.createElement("a");
commentsToggle.href = "#";
commentsToggle.textContent = t("commentsToggle");
commentsToggle.style.display = "inline-block";
commentsToggle.style.marginTop = "10px";
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

    // Solo insertar Utterances la primera vez
    if (!commentsDiv.hasChildNodes()) {
      const script = document.createElement("script");
      script.src = "https://utteranc.es/client.js";
      script.async = true;
      script.setAttribute("repo", "marcelomarronedev/free-for-dev"); 
      script.setAttribute("issue-term", feed.title);
      script.setAttribute("theme", "github-light");
      script.setAttribute("crossorigin", "anonymous");
      commentsDiv.appendChild(script);
    }
  } else {
    commentsDiv.style.display = "none";
  }
});

container.appendChild(commentsToggle);
container.appendChild(commentsDiv);

const h3El0 = container.querySelector("h3");

if (h3El0) {
  const voteBtn = document.createElement("span");
  voteBtn.style.cursor = "pointer";
  voteBtn.style.marginLeft = "10px";
  voteBtn.title = t("voteThisFeed");
  voteBtn.textContent = '👍';
  h3El0.appendChild(voteBtn);

  let votesSpan = h3El0.querySelector(".votes-count") as HTMLSpanElement | null;
  if (!votesSpan) {
    votesSpan = document.createElement("span");
    votesSpan.className = "votes-count";
    votesSpan.style.fontSize = "14px";
    votesSpan.style.color = "gray";
    votesSpan.style.marginLeft = "5px";
    votesSpan.textContent = `(${feed.votes ?? 0} votos)`;
    h3El0.appendChild(votesSpan);
  }

  
  voteBtn.addEventListener("click", async () => {
    try {
      // Lanza reCAPTCHA y espera el token
      const token = await new Promise<string>((resolve, reject) => {
        if (!(window as any).grecaptcha) {
          reject("reCAPTCHA not loaded");
          return;
        }
  
        (window as any).grecaptcha.ready(() => {
          (window as any).grecaptcha.execute("6LfbFhcsAAAAACjeQU-G9iCrhhOFi_U02Pt_3xNt", { action: "vote" }).then((token: string) => {
            if (token) resolve(token);
            else reject("Not valid token fro reCAPTCHA");
          });
        });
      });
  
      const language = (document.getElementById("languageSelect") as HTMLSelectElement).value;
      const category = (document.getElementById("categorySelect") as HTMLSelectElement).value;
      const country = (document.getElementById("countrySelect") as HTMLSelectElement).value;
  
      const response = await fetch('https://free-for-dev.alwaysdata.net/vote.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          feed: feed.title,
          language,
          cat: category,
          country,
          captchatoken: token
        })
      });
  
      if (response.status === 429) {
        Swal.fire({ icon: "warning", title: "Ups!", text: t("voteTooMany") });
        return;
      }
      if (response.status === 409) {
        Swal.fire({ icon: "info", title: "Ups!", text: t("voteDuplicate") });
        return;
      }
  
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          feed.votes = data.votes;
          votesSpan!.textContent = `(${feed.votes} ${t("votes")})`;
          Swal.fire({ icon: "success", title: "OK!", text: t("voteThanks"), timer: 2000, showConfirmButton: false });
        } else {
          console.error(t("voteError"), data);
          Swal.fire({ icon: "error", title: "Ups!", text: t("voteError") });
        }
      } else {
        console.error(t("voteError") + " " + response.statusText);
        Swal.fire({ icon: "error", title: "Ups!", text: t("voteError") + " " + response.status });
      }
    } catch (err) {
      console.error(t("voteError"), err);
      Swal.fire({ icon: "error", title: "Ups!", text: t("voteError") });
    }
  });
  
  


}




    });

  
    if (loading) loading.style.display = "none";
    container.style.display = "block";



  } catch (error) {
    console.error("Error reading feeds.txt or updating DOM:", error);
  }
}



export function validarImagen(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve(true);
    img.onerror = () => resolve(false);
    img.src = `${url}?_=${Date.now()}`;
  });
}



let refreshIntervalId: number | undefined;

function startAutoRefresh(intervalMs: number) {
  if (refreshIntervalId !== undefined) {
    clearInterval(refreshIntervalId);
  }

  if (intervalMs > 0) {
    refreshIntervalId = window.setInterval(() => {
      loadFeeds();
    }, intervalMs);
  }
}

document.addEventListener("DOMContentLoaded", () => {

  const PAGE_LANG = (window as any).PAGE_LANG || "en";

  loadCategories().then(() => {
    const languageSelect = document.getElementById("languageSelect") as HTMLSelectElement;

    if (languageSelect) {
      languageSelect.value = PAGE_LANG;

      // Deshabilita la opción correspondiente al idioma actual
      const option = languageSelect.querySelector(`#languageSelect option[value="${PAGE_LANG}"]`) as HTMLOptionElement | null;
      if (option) option.disabled = true;
    }
  });
  
  const dt = new Date();
  const footer = document.getElementById("getCurrentDate");
  if (footer) footer.textContent = dt.getFullYear().toString();

  const select = document.getElementById("refreshSelect") as HTMLSelectElement;
  if (select) {
    select.value = "300000"; // 5 minutos
    startAutoRefresh(Number(select.value));

    select.addEventListener("change", () => {
      startAutoRefresh(Number(select.value));
    });
  } else {
    console.error("No refresh select found");
  }





});

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs: number = 3000) {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    return response;
  } finally {
    clearTimeout(id);
  }
}


async function loadCategories() {
  try {
    const PAGE_LANG = (window as any).PAGE_LANG || "en";

    const response = await fetchWithTimeout("https://corsproxy.io/?https://free-for-dev.alwaysdata.net/categories.txt", { cache: "no-store" });
    const text = await response.text();

    const lines = text
    .split("\n")
    .map(l => l.trim())
    .filter(l => l && !l.startsWith("#"));

  allCategories = lines.map(line => {
    const parts = line.split("|");
    return {
      code: parts[0]?.trim() || "",
      name: parts[1]?.trim() || "",
      description: parts[2]?.trim() || "",
      subdescription: parts[3]?.trim() || "",
      countryCode: parts[4]?.trim() || "",
      countryName: parts[5]?.trim() || "",
      languageCode: parts[6]?.trim() || "",
      languageName: parts[7]?.trim() || ""
    };
  });

    const categorySelect = document.getElementById("categorySelect") as HTMLSelectElement;
    const countrySelect = document.getElementById("countrySelect") as HTMLSelectElement;
    const languageSelect = document.getElementById("languageSelect") as HTMLSelectElement;

    if (!categorySelect || !countrySelect || !languageSelect) return;

    const languages = Array.from(
      new Map(allCategories.map(cat => [cat.languageCode, cat.languageName]))
    );
    languages.sort((a, b) => a[1].localeCompare(b[1]));

    languageSelect.innerHTML = "";
    languages.forEach(([code, name]) => {
      const opt = document.createElement("option");
      opt.value = code;
      opt.textContent = name;
      languageSelect.appendChild(opt);
    });

    const { lang, country, cat } = getUrlParams();

    console.log("lang=["+lang+"]");
    console.log("cat=["+cat+"]");
    console.log("country=["+country+"]");

        languageSelect.value = lang;
        localStorage.setItem("selectedLanguage", lang);

const reloadCategoriesAndCountries = (selectedLang: string) => {

  const filteredCategories = allCategories.filter(cat => cat.languageCode === selectedLang);

  const uniqueCategories = Array.from(
    new Map(filteredCategories.map(cat => [cat.code, cat])).values()
  );

  uniqueCategories.sort((a, b) => a.name.localeCompare(b.name));

  categorySelect.innerHTML = "";
  uniqueCategories.forEach(cat => {
    const opt = document.createElement("option");
    opt.value = cat.code;
    opt.textContent = cat.name;
    categorySelect.appendChild(opt);
  });

  const selectedCategory =
    cat ||
    localStorage.getItem("selectedCategory") ||
    uniqueCategories[0]?.code ||
    "";
  categorySelect.value = selectedCategory;
  localStorage.setItem("selectedCategory", selectedCategory);

  const countriesMap = new Map<string, string>();
  filteredCategories.forEach(cat => countriesMap.set(cat.countryCode, cat.countryName));
  countrySelect.innerHTML = "";

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = t("allCountries");
  countrySelect.appendChild(defaultOpt);

  const countryList = Array.from(countriesMap.entries());
  countryList.sort((a, b) => a[1].localeCompare(b[1]));

  countriesMap.forEach((name, code) => {
    const opt = document.createElement("option");
    opt.value = code;
    opt.textContent = name;
    countrySelect.appendChild(opt);
  });

  let selectedCountry = "";
  if (country && country !== "") {
    selectedCountry =
      country ||
      localStorage.getItem("selectedCountry") ||
      countrySelect.options[0]?.value ||
      "";
  }

  countrySelect.value = selectedCountry;
  localStorage.setItem("selectedCountry", selectedCountry);

  updateCategoryHeader();
  if (!firstLoad) {
    loadFeeds();
  }
};

    reloadCategoriesAndCountries(lang);

    loadFeeds();
    firstLoad = false;

    updateCategoryHeader();

    languageSelect.addEventListener("change", () => {
      const selectedLang = languageSelect.value;
      const selectedCountry = '';  //porque puede no existir en otro idioma, así que ponemos "Todos los países"
      const selectedCategory = categorySelect.value;
      const targetUrl = `index-${selectedLang}.html?lang=${selectedLang}&country=${encodeURIComponent(selectedCountry)}&cat=${encodeURIComponent(selectedCategory)}`;
      window.location.href = targetUrl;
    });

    categorySelect.addEventListener("change", () => {
      const lang = languageSelect.value;
      const country = countrySelect.value;
      const cat = categorySelect.value;
      const newUrl = `?lang=${lang}&country=${encodeURIComponent(country)}&cat=${encodeURIComponent(cat)}`;
      history.replaceState(null, "", newUrl);
    
      localStorage.setItem("selectedCountry", countrySelect.value);
      localStorage.setItem("selectedCategory", categorySelect.value);
      updateCategoryHeader();
      loadFeeds();
    });
    countrySelect.addEventListener("change", () => {
      const lang = languageSelect.value;
      const country = countrySelect.value;
      const cat = categorySelect.value;
      const newUrl = `?lang=${lang}&country=${encodeURIComponent(country)}&cat=${encodeURIComponent(cat)}`;
      history.replaceState(null, "", newUrl);

      localStorage.setItem("selectedCountry", countrySelect.value);
      localStorage.setItem("selectedCategory", categorySelect.value);
      updateCategoryHeader();
      loadFeeds();
    });

  } catch (err) {
    console.error("Error loading categories.txt:", err);
  }
}

function updateCategoryHeader() {
  const selectedCategoryCode = (document.getElementById("categorySelect") as HTMLSelectElement)?.value;
  if (!selectedCategoryCode) return;

  const selectedLanguageCode = (document.getElementById("languageSelect") as HTMLSelectElement)?.value;
  if (!selectedLanguageCode) return;

  const category = allCategories.find(cat => cat.code === selectedCategoryCode && cat.languageCode  == selectedLanguageCode);
  if (!category) return;

  const catTitleEl = document.getElementById("cattitle");
  const catSubtitleEl = document.getElementById("catsubtitle");

  if (catTitleEl) catTitleEl.textContent = category.description;
  if (catSubtitleEl) catSubtitleEl.textContent = category.subdescription;
}

function getUrlParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    lang: (window as any).PAGE_LANG || "en",
    country: params.get("country") || "",
    cat: params.get("cat") || "AGR"
  };
}


const i18n = {
  en: {
    noFeeds: "No feeds match the selected filters.",
    addFeedSuccess: "Feed added successfully (will be moderated before publishing).",
    addFeedError: "Error adding the feed.",
    connectionError: "Connection error.",
    voteThanks: "Thank you! Your vote has been counted.",
    voteDuplicate: "You have already voted from this IP.",
    voteTooMany: "Too many requests from this network. Try later.",
    voteError: "Could not register your vote.",
    shareError: "Cannot share this news.",
    shareFailed: "Could not share the news.",
    historyTitle: "News history for",
    allCountries: "All countries",
    sharethisnews: "Share this news",
    voteThisFeed: "Vote this feed",
    viewHistory: "View news history",
    commentsToggle: "🗨️ Comments on this feed",
    feedTechnicalIssues: "This feed is experiencing technical issues",
    votes: "votes"
  },
  es: {
    noFeeds: "No hay feeds que coincidan con los filtros seleccionados.",
    addFeedSuccess: "Feed agregado correctamente al directorio (se moderará antes de publicarlo).",
    addFeedError: "Hubo un error al añadir el feed.",
    connectionError: "Error de conexión.",
    voteThanks: "¡Gracias! Su voto ha sido contabilizado.",
    voteDuplicate: "Ya se votó desde esta misma IP.",
    voteTooMany: "Demasiadas peticiones desde esta red. Inténtelo más tarde.",
    voteError: "No se pudo registrar su voto.",
    shareError: "No se puede compartir esta noticia.",
    shareFailed: "No se pudo compartir la noticia.",
    historyTitle: "Historial de noticias de",
    allCountries: "Todos los países",
    sharethisnews: "Compartir esta noticia",
    voteThisFeed: "Votar este feed",
    viewHistory: "Ver historial de noticias",
    commentsToggle: "🗨️ Comentarios sobre este feed",
    feedTechnicalIssues: "Este feed está teniendo problemas técnicos",
    votes: "votos"
  }
};



function t(key: keyof typeof i18n["en"]): string {
  const lang = ((window as any).PAGE_LANG || "en") as keyof typeof i18n;
  if (!i18n[lang]) return key;
  return i18n[lang][key] ?? key;
}


