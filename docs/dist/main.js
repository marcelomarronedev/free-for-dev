var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function fetchWithTimeout(url_1) {
    return __awaiter(this, arguments, void 0, function* (url, options = {}, timeoutMs = 5000) {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeoutMs);
        try {
            const response = yield fetch(url, Object.assign(Object.assign({}, options), { signal: controller.signal }));
            return response;
        }
        finally {
            clearTimeout(id);
        }
    });
}
function parseCSVLine(line) {
    const result = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
        const ch = line[i];
        if (ch === '"' && line[i + 1] === '"') {
            // escaped quote -> append one quote and skip next
            current += '"';
            i++;
        }
        else if (ch === '"') {
            inQuotes = !inQuotes;
        }
        else if (ch === ',' && !inQuotes) {
            result.push(current);
            current = "";
        }
        else {
            current += ch;
        }
    }
    result.push(current);
    return result.map(s => s.trim());
}
export function validarImagen(url) {
    return new Promise((resolve) => {
        if (!url)
            return resolve(false);
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = `${url}?_=${Date.now()}`;
    });
}
function fetchFeedsList() {
    return __awaiter(this, void 0, void 0, function* () {
        const remote = "https://corsproxy.io/?https://free-for-dev.alwaysdata.net/feeds.txt";
        const resp = yield fetchWithTimeout(remote, { cache: "no-store" }, 7000);
        if (!resp || !resp.ok)
            throw new Error("Cannot load feeds.txt");
        const txt = yield resp.text();
        const lines = txt.split("\n").map(l => l.trim()).filter(l => l && !l.startsWith("#"));
        const feeds = lines.map(line => {
            var _a, _b, _c, _d, _e;
            const parts = parseCSVLine(line);
            return {
                code: (_a = parts[0]) !== null && _a !== void 0 ? _a : "",
                name: (_c = (_b = parts[1]) !== null && _b !== void 0 ? _b : parts[1]) !== null && _c !== void 0 ? _c : "",
                url: (_d = parts[2]) !== null && _d !== void 0 ? _d : "",
                defaultImage: (_e = parts[3]) !== null && _e !== void 0 ? _e : ""
            };
        }).filter(f => f.code && f.url && f.name);
        return feeds;
    });
}
function getFeedItems(feedUrl) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const resp = yield fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(feedUrl)}`, { cache: "no-store" }, 7000);
            if (!resp || !resp.ok) {
                console.warn("Feed ignored (http error):", resp === null || resp === void 0 ? void 0 : resp.status, feedUrl);
                return [];
            }
            const xmlText = yield resp.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(xmlText, "application/xml");
            const itemNodes = Array.from(xml.querySelectorAll("item"));
            const items = itemNodes.map(item => {
                var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l;
                const title = (_c = (_b = (_a = item.querySelector("title")) === null || _a === void 0 ? void 0 : _a.textContent) === null || _b === void 0 ? void 0 : _b.trim()) !== null && _c !== void 0 ? _c : "";
                const link = (_f = (_e = (_d = item.querySelector("link")) === null || _d === void 0 ? void 0 : _d.textContent) === null || _e === void 0 ? void 0 : _e.trim()) !== null && _f !== void 0 ? _f : ((_j = (_h = (_g = item.querySelector("guid")) === null || _g === void 0 ? void 0 : _g.textContent) === null || _h === void 0 ? void 0 : _h.trim()) !== null && _j !== void 0 ? _j : "");
                // enclosure or media:content
                const enclosure = item.querySelector("enclosure");
                const media = item.querySelector("media\\:content, media\\:thumbnail");
                let imageUrl = (_l = (_k = enclosure === null || enclosure === void 0 ? void 0 : enclosure.getAttribute("url")) !== null && _k !== void 0 ? _k : media === null || media === void 0 ? void 0 : media.getAttribute("url")) !== null && _l !== void 0 ? _l : "";
                // If still empty, don't try to parse description for image per your new spec.
                const pubDate = "";
                return { title, link, imageUrl, pubDate };
            });
            return items;
        }
        catch (err) {
            console.error("Error reading feed:", feedUrl, err);
            return [];
        }
    });
}
function makeSelectOption(feed) {
    const opt = document.createElement("option");
    opt.value = feed.code;
    opt.textContent = feed.name;
    return opt;
}
function renderItemsGrid(items, defaultImage, container, selectedFeeed) {
    container.innerHTML = "";
    if (!items || items.length === 0) {
        container.innerHTML = `<p style="text-align:center; font-weight:bold; margin-top:20px;">${t("noFeeds")}</p>`;
        return;
    }
    const fragment = document.createDocumentFragment();
    let row = null;
    items.forEach((item, idx) => {
        var _a, _b;
        if (idx % 3 === 0) {
            row = document.createElement("div");
            row.className = "row mb-4";
            fragment.appendChild(row);
        }
        if (!item)
            return;
        const col = document.createElement("div");
        col.className = "col-md-4";
        const card = document.createElement("div");
        card.className = "card h-100 shadow-sm";
        const imgLink = document.createElement("a");
        imgLink.href = item.link || "#";
        imgLink.target = "_blank";
        imgLink.rel = "noopener noreferrer";
        const img = document.createElement("img");
        img.alt = (_a = item.title) !== null && _a !== void 0 ? _a : "";
        img.src = defaultImage || "https://marcelomarronedev.github.io/free-for-dev/img/logo.png";
        img.style.borderRadius = "8px";
        img.style.border = "1px solid #ccc";
        img.style.height = "200px";
        img.style.width = "100%";
        img.style.objectFit = "cover";
        imgLink.appendChild(img);
        (() => __awaiter(this, void 0, void 0, function* () {
            var _a;
            try {
                const candidate = (_a = item.imageUrl) !== null && _a !== void 0 ? _a : "";
                if (candidate) {
                    const ok = yield validarImagen(candidate);
                    img.src = ok ? candidate : (defaultImage || "https://marcelomarronedev.github.io/free-for-dev/img/logo.png");
                }
                else {
                    img.src = defaultImage || "https://marcelomarronedev.github.io/free-for-dev/img/logo.png";
                }
            }
            catch (e) {
                img.src = defaultImage || "https://marcelomarronedev.github.io/free-for-dev/img/logo.png";
            }
        }))();
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
        votesSpan.textContent = `(${(_b = item.votes) !== null && _b !== void 0 ? _b : 0} ${t("votes")})`;
        voteBtn.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
            try {
                const token = yield new Promise((resolve, reject) => {
                    if (!window.grecaptcha)
                        return reject("reCAPTCHA not loaded");
                    window.grecaptcha.ready(() => {
                        window.grecaptcha.execute("6LfbFhcsAAAAACjeQU-G9iCrhhOFi_U02Pt_3xNt", { action: "vote" })
                            .then((token) => token ? resolve(token) : reject("Invalid token"));
                    });
                });
                const category = document.getElementById("categorySelect").value;
                const response = yield fetch("https://free-for-dev.alwaysdata.net/vote.php", {
                    method: "POST",
                    headers: { "Content-Type": "application/x-www-form-urlencoded" },
                    body: new URLSearchParams({
                        feed: item.link,
                        cat: category,
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
                    const data = yield response.json();
                    if (data.success) {
                        item.votes = data.votes;
                        votesSpan.textContent = `(${item.votes} ${t("votes")})`;
                        Swal.fire({ icon: "success", title: "OK!", text: t("voteThanks"), timer: 2000, showConfirmButton: false });
                    }
                    else {
                        Swal.fire({ icon: "error", title: "Ups!", text: t("voteError") });
                    }
                }
                else {
                    Swal.fire({ icon: "error", title: "Ups!", text: t("voteError") + " " + response.status });
                }
            }
            catch (err) {
                console.error(t("voteError"), err);
                Swal.fire({ icon: "error", title: "Ups!", text: t("voteError") });
            }
        }));
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
            }
            else {
                commentsDiv.style.display = "none";
            }
        });
        cardBody.appendChild(commentsToggle);
        cardBody.appendChild(commentsDiv);
        card.appendChild(cardBody);
        col.appendChild(card);
        if (row)
            row.appendChild(col);
    });
    container.appendChild(fragment);
}
function getSelectedCatFromUrl() {
    var _a;
    const params = new URLSearchParams(window.location.search);
    return (_a = params.get("cat")) !== null && _a !== void 0 ? _a : "001";
}
function setSelectedCatInUrl(code) {
    const url = new URL(window.location.href);
    url.searchParams.set("cat", code);
    history.replaceState(null, "", url.toString());
}
function initFeedsModule() {
    return __awaiter(this, void 0, void 0, function* () {
        var _a, _b;
        try {
            const container = document.getElementById("feeds-container");
            if (!container) {
                console.warn("No #feeds-container found in DOM");
                return;
            }
            const loadingEl = document.getElementById("loading-container");
            const selectEl = document.getElementById("categorySelect");
            if (!selectEl) {
                console.warn("No #categorySelect found in DOM");
                return;
            }
            if (loadingEl)
                loadingEl.style.display = "block";
            const feeds = yield fetchFeedsList();
            selectEl.innerHTML = "";
            feeds.forEach(feed => selectEl.appendChild(makeSelectOption(feed)));
            const defaultCat = getSelectedCatFromUrl();
            let selectedCat = feeds.some(f => f.code === defaultCat) ? defaultCat : ((_b = (_a = feeds[0]) === null || _a === void 0 ? void 0 : _a.code) !== null && _b !== void 0 ? _b : "001");
            selectEl.value = selectedCat;
            const selectedFeed = feeds.find(f => f.code === selectedCat);
            if (selectedFeed) {
                const items = yield getFeedItems(selectedFeed.url);
                const votesMap = yield fetchVotes(selectedFeed.code);
                items.forEach(item => {
                    var _a;
                    const key = item.link.trim().toLowerCase();
                    item.votes = (_a = votesMap[key]) !== null && _a !== void 0 ? _a : 0;
                });
                items.sort((a, b) => { var _a, _b; return ((_a = b.votes) !== null && _a !== void 0 ? _a : 0) - ((_b = a.votes) !== null && _b !== void 0 ? _b : 0); });
                container.style.display = "block";
                renderItemsGrid(items, selectedFeed.defaultImage, container, selectedFeed);
            }
            else {
                container.innerHTML = `<p style="text-align:center; font-weight:bold; margin-top:20px;">${t("noFeeds")}</p>`;
            }
            const catTitleEl = document.getElementById("cattitle");
            if (catTitleEl && selectedFeed) {
                catTitleEl.textContent = `Free resources for developers: ${selectedFeed.name}`;
            }
            if (loadingEl)
                loadingEl.style.display = "none";
            selectEl.addEventListener("change", () => __awaiter(this, void 0, void 0, function* () {
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
                if (loadingEl)
                    loadingEl.style.display = "block";
                const items = yield getFeedItems(feed.url);
                const votesMap = yield fetchVotes(feed.code);
                items.forEach(item => {
                    var _a;
                    const key = item.title.trim().toLowerCase();
                    item.votes = (_a = votesMap[key]) !== null && _a !== void 0 ? _a : 0;
                });
                items.sort((a, b) => { var _a, _b; return ((_a = b.votes) !== null && _a !== void 0 ? _a : 0) - ((_b = a.votes) !== null && _b !== void 0 ? _b : 0); });
                container.style.display = "block";
                renderItemsGrid(items, feed.defaultImage, container, feed);
                if (loadingEl)
                    loadingEl.style.display = "none";
                /* Scroll to container smoothly
                setTimeout(() => {
                  const rect = container.getBoundingClientRect();
                  window.scrollTo({ top: window.scrollY + rect.top - 90, behavior: "smooth" });
                }, 120);*/
            }));
        }
        catch (err) {
            console.error("initFeedsModule error:", err);
            const loadingEl = document.getElementById("loading-container");
            if (loadingEl)
                loadingEl.style.display = "none";
            const container = document.getElementById("feeds-container");
            if (container)
                container.innerHTML = `<p style="text-align:center; font-weight:bold; margin-top:20px;">${t("connectionError")}</p>`;
        }
    });
}
document.addEventListener("DOMContentLoaded", () => {
    initFeedsModule();
    //Collapsable menu
    const navbarCollapse = document.querySelector(".navbar-ex1-collapse");
    function closeNavbar() {
        if (navbarCollapse && navbarCollapse.classList.contains("in")) {
            const toggleButton = document.querySelector(".navbar-toggle");
            ;
            if (toggleButton)
                toggleButton.click();
        }
    }
    const navLinks = document.querySelectorAll(".navbar-ex1-collapse a");
    navLinks.forEach(link => {
        link.addEventListener("click", closeNavbar);
    });
    const categorySelect = document.getElementById("categorySelect");
    if (categorySelect) {
        categorySelect.addEventListener("change", closeNavbar);
    }
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
function t(key) {
    var _a;
    const lang = (window.PAGE_LANG || "en");
    if (!i18n[lang])
        return key;
    return (_a = i18n[lang][key]) !== null && _a !== void 0 ? _a : key;
}
function fetchVotes(categoryCode) {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            const resp = yield fetch(`https://free-for-dev.alwaysdata.net/getvotes.php?&cat=${encodeURIComponent(categoryCode)}&nocache=${Date.now()}`, {
                cache: "no-store"
            });
            if (!resp.ok) {
                console.warn("Error getting votes. Status:", resp.status);
                return {};
            }
            const votesData = yield resp.json();
            const votesMap = {};
            votesData.forEach(v => {
                votesMap[v.feed.trim().toLowerCase()] = v.votes;
            });
            return votesMap;
        }
        catch (err) {
            console.error("Error getting votes:", err);
            return {};
        }
    });
}
