var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
function getFirstItem(feedUrl_1, type_1) {
    return __awaiter(this, arguments, void 0, function* (feedUrl, type, useDescriptionForImage = false) {
        var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
        try {
            const response = yield fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(feedUrl)}`, { cache: "no-store" });
            const isAtom = type === "atom";
            //console.log("feedUrl.=" + feedUrl);
            //console.log("response.ok=" + response.ok + " - response.status=" + response.status);
            // Si recibimos 429 u otro error HTTP, ignoramos este feed
            if (!response.ok) {
                if (response.status != 200) {
                    console.warn(`Feed ignorado por error ${response.status}: ${feedUrl}`);
                    return null; // retornamos null para que no se renderice
                }
                throw new Error(`Error HTTP ${response.status}`);
            }
            const xmlText = yield response.text();
            const parser = new DOMParser();
            const xml = parser.parseFromString(xmlText, "application/xml");
            let item = null;
            if (isAtom) {
                // Para Atom, buscamos el primer <entry>
                item = xml.querySelector("entry");
            }
            else {
                // Si es RSS, buscamos el primer <item>
                item = xml.querySelector("item");
            }
            if (!item) {
                console.error("No se encontró el elemento <entry> o <item> en el feed.");
                return null;
            }
            const title = (_b = (_a = item.querySelector("title")) === null || _a === void 0 ? void 0 : _a.textContent) !== null && _b !== void 0 ? _b : "";
            let link = "";
            if (isAtom) // Para Atom (Reddit), revisamos todos los enlaces posibles
                link = (_d = (_c = item.querySelector("link")) === null || _c === void 0 ? void 0 : _c.getAttribute("href")) !== null && _d !== void 0 ? _d : "";
            else // En RSS normal, buscamos el primer <link>
                link = (_f = (_e = item.querySelector("link")) === null || _e === void 0 ? void 0 : _e.textContent) !== null && _f !== void 0 ? _f : "";
            // Imagen
            let imageUrl = "";
            if (isAtom) {
                // En Atom, la imagen puede estar en el contenido de la entrada (<content>)
                const content = (_h = (_g = item.querySelector("content")) === null || _g === void 0 ? void 0 : _g.textContent) !== null && _h !== void 0 ? _h : "";
                const imgMatch = content.match(/<img[^>]+src=['"]([^'"]+)['"]/);
                if (imgMatch)
                    imageUrl = imgMatch[1];
            }
            else {
                // En RSS, buscamos la imagen en <media:content> o <enclosure>
                const media = item.querySelector("media\\:content, enclosure");
                if (media)
                    imageUrl = (_j = media.getAttribute("url")) !== null && _j !== void 0 ? _j : "";
            }
            // Si no encontramos una imagen, tratamos de obtenerla desde la descripción (si está habilitado)
            if (!imageUrl && useDescriptionForImage) {
                const description = (_l = (_k = item.querySelector("description")) === null || _k === void 0 ? void 0 : _k.textContent) !== null && _l !== void 0 ? _l : "";
                const match = description.match(/<img[^>]+src=['"]([^'"]+)['"]/);
                if (match)
                    imageUrl = match[1];
            }
            // Fecha de publicación
            let pubDate = "";
            if (isAtom) {
                const updatedRaw = (_o = (_m = item.querySelector("updated")) === null || _m === void 0 ? void 0 : _m.textContent) !== null && _o !== void 0 ? _o : "";
                if (updatedRaw) {
                    const updatedDate = new Date(updatedRaw);
                    pubDate = formatDate(updatedDate); // Asumiendo que formatDate es una función que convierte la fecha
                }
            }
            else {
                // En RSS, usamos <pubDate> si está disponible
                const pubDateRaw = (_q = (_p = item.querySelector("pubDate")) === null || _p === void 0 ? void 0 : _p.textContent) !== null && _q !== void 0 ? _q : "";
                const pubDateObj = pubDateRaw ? new Date(pubDateRaw) : null;
                pubDate = pubDateObj ? formatDate(pubDateObj) : "";
            }
            if (link) {
                try {
                    const urlObj = new URL(link);
                    const host = urlObj.host;
                    const storedDataJson = localStorage.getItem("feedsHistory");
                    let storedData = storedDataJson ? JSON.parse(storedDataJson) : [];
                    const exists = storedData.some(item => item.link === link);
                    if (!exists) {
                        if (!imageUrl) {
                            const feedsTxt = yield fetch("feeds.txt", { cache: "no-store" }).then(res => res.text());
                            const lines = feedsTxt.split("\n").map(line => line.trim()).filter(line => line);
                            const feedDefault = lines.find(line => line.includes(feedUrl));
                            if (feedDefault) {
                                const parts = feedDefault.split(",");
                                imageUrl = parts[2] || ""; // la tercera columna es la imagen por defecto
                            }
                        }
                        //Validar imagen antes de guardar:
                        const esValida = yield validarImagen(imageUrl);
                        if (!esValida) {
                            // Si no es válida, usar imagen por defecto (si existe)
                            const feedsTxt = yield fetch("feeds.txt", { cache: "no-store" }).then(res => res.text());
                            const lines = feedsTxt.split("\n").map(line => line.trim()).filter(line => line);
                            const feedDefault = lines.find(line => line.includes(feedUrl));
                            if (feedDefault) {
                                const parts = feedDefault.split(",");
                                imageUrl = parts[2] || "";
                            }
                        }
                        let storedData = storedDataJson ? JSON.parse(storedDataJson) : [];
                        storedData.push({ host, title, link, imageUrl, pubDate, type: type });
                        localStorage.setItem("feedsHistory", JSON.stringify(storedData));
                    }
                }
                catch (err) {
                    console.error("Error guardando feedsHistory en localStorage:", err);
                }
            }
            return { title, link, imageUrl, pubDate };
        }
        catch (error) {
            console.error("Error cargando feed:", feedUrl, error);
            return null;
        }
    });
}
function formatDate(date) {
    const pad = (n) => n.toString().padStart(2, "0");
    const day = pad(date.getDate());
    const month = pad(date.getMonth() + 1);
    const year = date.getFullYear();
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
}
function loadFeeds() {
    return __awaiter(this, void 0, void 0, function* () {
        try {
            // Contenedor donde se generarán los feeds
            const container = document.getElementById("feeds-container");
            if (!container)
                return;
            container.style.display = "none";
            const loading = document.getElementById("loading-container");
            if (loading)
                loading.style.display = "block"; // mostrar spinner
            // Leer feeds.txt
            const feedsTxt = yield fetch("feeds.txt", { cache: "no-store" }).then(res => res.text());
            const lines = feedsTxt.split("\n").map(line => line.trim()).filter(line => line);
            // 🔹 Obtener los votos desde el backend
            let votesData = [];
            try {
                const votesResponse = yield fetch("https://enterum.alwaysdata.net/getvotes.php?nocache=" + Date.now(), {
                    cache: "no-store"
                });
                if (votesResponse.ok) {
                    votesData = yield votesResponse.json();
                }
                else {
                    console.warn("No se pudo obtener la lista de votos. Status:", votesResponse.status);
                }
            }
            catch (err) {
                console.error("Error al obtener los votos:", err);
            }
            let feedsWithImages = lines.map(line => {
                const [title, url, defaultImage, type, useDescription] = line.split(",");
                const feedVotes = votesData.find(v => v.feed.trim().toLowerCase() === title.trim().toLowerCase());
                return {
                    title,
                    url,
                    defaultImage,
                    type: (type || "rss").trim().toLowerCase(),
                    useDescriptionForImage: (useDescription === null || useDescription === void 0 ? void 0 : useDescription.trim().toLowerCase()) === "true",
                    votes: feedVotes ? feedVotes.votes : 0
                };
            });
            feedsWithImages.sort((a, b) => b.votes - a.votes);
            // Limpiar solo este contenedor
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
        <a target="_blank" href="#"><img class="img-responsive" src="#"></a>
        <h3>${feed.title} <span class="votes-count" style="font-size:14px; color:gray;">(${feed.votes} votos)</span></h3>
        <p><a target="_blank" href="##">...</a></p>
        <p class="pubdate"></p>
      `;
                    rowDiv.appendChild(colDiv);
                }
                container.appendChild(rowDiv);
            }
            // Obtener items
            const items = yield Promise.all(feedsWithImages.map(feed => getFirstItem(feed.url, feed.type, feed.useDescriptionForImage)));
            // Actualizar contenido de cada feed
            items.forEach((feedItem, index) => {
                var _a, _b;
                const container = document.querySelector(`.portfolio-item[data-feed="${index}"]`);
                if (!container)
                    return;
                if (!feedItem) {
                    container.style.display = 'none';
                    return;
                }
                const feed = feedsWithImages[index];
                const linkEl = container.querySelector("a");
                const imgEl = container.querySelector("img");
                const titleEl = container.querySelector("p a");
                const pubDateEl = container.querySelector("p.pubdate");
                let finalImage = feedsWithImages[index].defaultImage;
                validarImagen(feedItem.imageUrl).then(esValida => {
                    finalImage = esValida
                        ? feedItem.imageUrl
                        : feedsWithImages[index].defaultImage;
                    if (linkEl)
                        linkEl.href = feedItem.link;
                    if (imgEl)
                        imgEl.src = finalImage;
                    if (titleEl) {
                        titleEl.textContent = feedItem.title;
                        titleEl.href = feedItem.link;
                    }
                    if (pubDateEl)
                        pubDateEl.textContent = feedItem.pubDate;
                });
                // Dentro del forEach donde ya tienes container definido
                const commentsToggle = document.createElement("a");
                commentsToggle.href = "#";
                commentsToggle.textContent = "🗨️ Comentarios sobre este agregador";
                commentsToggle.style.display = "inline-block";
                commentsToggle.style.marginTop = "10px";
                commentsToggle.style.cursor = "pointer";
                // Div para comentarios, inicialmente oculto
                const commentsDiv = document.createElement("div");
                commentsDiv.style.display = "none";
                commentsDiv.style.height = "300px"; // altura fija
                commentsDiv.style.overflowY = "auto"; // scroll vertical
                commentsDiv.style.marginTop = "10px";
                commentsDiv.style.border = "1px solid #ccc";
                commentsDiv.style.padding = "10px";
                commentsDiv.style.borderRadius = "8px";
                // Toggle para mostrar/ocultar comentarios
                commentsToggle.addEventListener("click", (e) => {
                    e.preventDefault();
                    if (commentsDiv.style.display === "none") {
                        commentsDiv.style.display = "block";
                        // Solo insertar Utterances la primera vez
                        if (!commentsDiv.hasChildNodes()) {
                            const script = document.createElement("script");
                            script.src = "https://utteranc.es/client.js";
                            script.async = true;
                            script.setAttribute("repo", "enterum/feeds-comments"); // tu repo
                            script.setAttribute("issue-term", `${feed.title}`);
                            script.setAttribute("theme", "github-light");
                            script.setAttribute("crossorigin", "anonymous");
                            commentsDiv.appendChild(script);
                        }
                    }
                    else {
                        commentsDiv.style.display = "none";
                    }
                });
                // Añadir al feed
                container.appendChild(commentsToggle);
                container.appendChild(commentsDiv);
                //Nueva funcionalidad 11/11/2025: // Botón de voto 👍
                const h3El0 = container.querySelector("h3");
                // Dentro del forEach donde ya tienes h3El
                if (h3El0) {
                    // Crear botón 👍
                    const voteBtn = document.createElement("span");
                    voteBtn.style.cursor = "pointer";
                    voteBtn.style.marginLeft = "10px";
                    voteBtn.title = "Votar este feed";
                    voteBtn.textContent = '👍';
                    h3El0.appendChild(voteBtn);
                    // Encontrar (o crear) el span de votos
                    let votesSpan = h3El0.querySelector(".votes-count");
                    if (!votesSpan) {
                        votesSpan = document.createElement("span");
                        votesSpan.className = "votes-count";
                        votesSpan.style.fontSize = "14px";
                        votesSpan.style.color = "gray";
                        votesSpan.style.marginLeft = "5px";
                        votesSpan.textContent = `(${(_a = feed.votes) !== null && _a !== void 0 ? _a : 0} votos)`;
                        h3El0.appendChild(votesSpan);
                    }
                    // Evento click
                    voteBtn.addEventListener("click", () => __awaiter(this, void 0, void 0, function* () {
                        try {
                            const response = yield fetch(`https://enterum.alwaysdata.net/vote.php?feed=${encodeURIComponent(feed.title)}`);
                            // 429 → demasiadas peticiones desde esta red
                            if (response.status === 429) {
                                Swal.fire({
                                    icon: "warning",
                                    title: "Demasiadas peticiones",
                                    text: "Demasiadas peticiones desde esta red. Inténtelo más tarde.",
                                });
                                return;
                            }
                            // 409 → ya se votó desde esta IP
                            if (response.status === 409) {
                                Swal.fire({
                                    icon: "info",
                                    title: "Voto duplicado",
                                    text: "Ya se votó desde esta misma IP.",
                                });
                                return;
                            }
                            if (response.ok) {
                                const data = yield response.json();
                                if (data.success) {
                                    // Actualizar votos con el valor que devuelve el backend
                                    feed.votes = data.votes;
                                    votesSpan.textContent = `(${feed.votes} votos)`;
                                    // ✅ Mostrar mensaje de éxito
                                    Swal.fire({
                                        icon: "success",
                                        title: "¡Gracias!",
                                        text: "Su voto ha sido contabilizado.",
                                        timer: 2000,
                                        showConfirmButton: false,
                                    });
                                }
                                else {
                                    console.error("Error al registrar el voto:", data);
                                    Swal.fire({
                                        icon: "error",
                                        title: "Error",
                                        text: "No se pudo registrar su voto.",
                                    });
                                }
                            }
                            else {
                                console.error("Error al registrar el voto:", response.statusText);
                                Swal.fire({
                                    icon: "error",
                                    title: "Error",
                                    text: `No se pudo registrar el voto. (${response.status})`,
                                });
                            }
                        }
                        catch (err) {
                            console.error("Error de red al votar:", err);
                            Swal.fire({
                                icon: "error",
                                title: "Error de conexión",
                                text: "No se pudo conectar con el servidor.",
                            });
                        }
                    }));
                }
                // Nueva funcionalidad 05/11/2025: Mostrar histórico:
                const h3El = container.querySelector("h3");
                if (h3El) {
                    const emoji = ((_b = h3El.textContent) === null || _b === void 0 ? void 0 : _b.includes("🕒")) ? h3El.querySelector("span") : null;
                    let emojiEl;
                    if (!emoji) {
                        emojiEl = document.createElement("span");
                        emojiEl.style.cursor = "pointer";
                        emojiEl.style.marginLeft = "5px";
                        emojiEl.textContent = "🕒";
                        emojiEl.title = "Ver historial de noticias";
                        h3El.appendChild(emojiEl);
                    }
                    else {
                        emojiEl = emoji;
                    }
                    // NUEVO: Emoji de compartir 🔗
                    let emojiShare = h3El.querySelector(".share");
                    if (!emojiShare) {
                        emojiShare = document.createElement("span");
                        emojiShare.className = "share";
                        emojiShare.style.cursor = "pointer";
                        emojiShare.style.marginLeft = "5px";
                        emojiShare.textContent = "🔗";
                        emojiShare.title = "Compartir esta noticia";
                        h3El.appendChild(emojiShare);
                        // Evento de click del compartir
                        emojiShare.addEventListener("click", () => {
                            if (!navigator.share) {
                                alert("Tu navegador no soporta compartir");
                                return;
                            }
                            navigator.share({
                                title: feed.title, // nombre del feed
                                text: feedItem.title, // titular de la noticia
                                url: feedItem.link, // url de la noticia
                            })
                                .then(() => console.log('Compartido con éxito'))
                                .catch((error) => console.log('Error al compartir', error));
                        });
                    }
                    emojiEl.addEventListener("click", () => {
                        const historyContainer = document.getElementById("history-container");
                        if (!historyContainer)
                            return;
                        // Limpiar contenido previo
                        historyContainer.innerHTML = "";
                        try {
                            const storedDataJson = localStorage.getItem("feedsHistory");
                            let storedData = storedDataJson ? JSON.parse(storedDataJson) : [];
                            const urlObj = new URL(feedItem.link);
                            const host = urlObj.host;
                            const filtered = storedData.filter(item => item.host === host);
                            filtered.sort((a, b) => (a.pubDate < b.pubDate ? 1 : a.pubDate > b.pubDate ? -1 : 0));
                            // Título centrado
                            const h3 = document.createElement("h3");
                            h3.textContent = `Historial de noticias de ${feed.title} hasta el momento:`;
                            h3.style.textAlign = "center";
                            h3.style.marginBottom = "20px"; // opcional para separar de la tabla
                            historyContainer.appendChild(h3);
                            const table = document.createElement("table");
                            table.style.width = "100%";
                            table.style.borderCollapse = "collapse";
                            filtered.forEach(item => {
                                const tr = document.createElement("tr");
                                tr.style.borderBottom = "1px solid #ccc";
                                tr.style.padding = "5px";
                                tr.style.paddingBottom = "10px";
                                const tdImg = document.createElement("td");
                                tdImg.style.width = "100px";
                                const img = document.createElement("img");
                                img.src = item.imageUrl;
                                img.style.maxHeight = "100px";
                                img.style.width = "100%";
                                img.style.height = "100px";
                                img.style.objectFit = "cover";
                                img.style.borderRadius = "12px";
                                img.style.display = "block";
                                img.style.border = "1px solid #ddd";
                                img.style.marginRight = "20px";
                                tdImg.appendChild(img);
                                const tdTitle = document.createElement("td");
                                tdTitle.style.paddingLeft = "20px";
                                const a = document.createElement("a");
                                a.href = item.link;
                                a.target = "_blank";
                                a.style.fontSize = "17px";
                                a.textContent = item.title;
                                tdTitle.appendChild(a);
                                const tdDate = document.createElement("td");
                                tdDate.textContent = item.pubDate;
                                tr.appendChild(tdImg);
                                tr.appendChild(tdTitle);
                                tr.appendChild(tdDate);
                                table.appendChild(tr);
                            });
                            historyContainer.appendChild(table);
                            historyContainer.style.display = "block";
                            // Hacer scroll hacia el historial
                            const rect = historyContainer.getBoundingClientRect();
                            const scrollTop = window.scrollY + rect.top - 100;
                            window.scrollTo({ top: scrollTop, behavior: "smooth" });
                        }
                        catch (err) {
                            console.error("Error mostrando historial:", err);
                        }
                    });
                }
            });
            // Ocultar spinner una vez cargados los feeds
            if (loading)
                loading.style.display = "none";
            container.style.display = "block";
            saveHistorial(true, 5);
        }
        catch (error) {
            console.error("Error leyendo feeds.txt o actualizando DOM:", error);
        }
    });
}
function saveHistorial() {
    return __awaiter(this, arguments, void 0, function* (useDescriptionForImage = false, maxConcurrent = 5) {
        try {
            const feedsTxt = yield fetch("feeds.txt", { cache: "no-store" }).then(res => res.text());
            const lines = feedsTxt.split("\n").map(line => line.trim()).filter(line => line && !line.startsWith("#"));
            const feeds = lines.map(line => {
                var _a, _b, _c, _d, _e;
                const parts = line.split(",");
                return {
                    title: (_a = parts[0]) === null || _a === void 0 ? void 0 : _a.trim(),
                    url: (_b = parts[1]) === null || _b === void 0 ? void 0 : _b.trim(),
                    defaultImage: ((_c = parts[2]) === null || _c === void 0 ? void 0 : _c.trim()) || "",
                    type: (((_d = parts[3]) === null || _d === void 0 ? void 0 : _d.trim()) || "rss").toLowerCase(),
                    useDescriptionForImage: (((_e = parts[4]) === null || _e === void 0 ? void 0 : _e.trim().toLowerCase()) === "true") // <-- nueva propiedad
                };
            });
            const storedDataJson = localStorage.getItem("feedsHistory");
            let storedData = storedDataJson ? JSON.parse(storedDataJson) : [];
            // Pool de concurrencia
            let active = 0;
            let index = 0;
            return new Promise((resolve) => {
                const next = () => __awaiter(this, void 0, void 0, function* () {
                    if (index >= feeds.length) {
                        if (active === 0) {
                            localStorage.setItem("feedsHistory", JSON.stringify(storedData));
                            resolve();
                        }
                        return;
                    }
                    while (active < maxConcurrent && index < feeds.length) {
                        const feed = feeds[index++];
                        active++;
                        (() => __awaiter(this, void 0, void 0, function* () {
                            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q;
                            try {
                                const response = yield fetchWithTimeout(`https://corsproxy.io/?${encodeURIComponent(feed.url)}`, { cache: "no-store" });
                                const xmlText = yield response.text();
                                const parser = new DOMParser();
                                const xml = parser.parseFromString(xmlText, "application/xml");
                                const isAtom = feed.url.includes("reddit.com");
                                const items = isAtom ? Array.from(xml.querySelectorAll("entry")) : Array.from(xml.querySelectorAll("item"));
                                for (const item of items) {
                                    const title = (_b = (_a = item.querySelector("title")) === null || _a === void 0 ? void 0 : _a.textContent) !== null && _b !== void 0 ? _b : "";
                                    let link = "";
                                    if (isAtom)
                                        link = (_d = (_c = item.querySelector("link")) === null || _c === void 0 ? void 0 : _c.getAttribute("href")) !== null && _d !== void 0 ? _d : "";
                                    else
                                        link = (_f = (_e = item.querySelector("link")) === null || _e === void 0 ? void 0 : _e.textContent) !== null && _f !== void 0 ? _f : "";
                                    if (!link)
                                        continue;
                                    // Imagen
                                    let imageUrl = "";
                                    if (isAtom) {
                                        const content = (_h = (_g = item.querySelector("content")) === null || _g === void 0 ? void 0 : _g.textContent) !== null && _h !== void 0 ? _h : "";
                                        const imgMatch = content.match(/<img[^>]+src=['"]([^'"]+)['"]/);
                                        if (imgMatch)
                                            imageUrl = imgMatch[1];
                                    }
                                    else {
                                        const media = item.querySelector("media\\:content, enclosure");
                                        if (media)
                                            imageUrl = (_j = media.getAttribute("url")) !== null && _j !== void 0 ? _j : "";
                                    }
                                    if (!imageUrl && useDescriptionForImage) {
                                        const description = (_l = (_k = item.querySelector("description")) === null || _k === void 0 ? void 0 : _k.textContent) !== null && _l !== void 0 ? _l : "";
                                        const match = description.match(/<img[^>]+src=['"]([^'"]+)['"]/);
                                        if (match)
                                            imageUrl = match[1];
                                    }
                                    // Fecha
                                    let pubDate = "";
                                    if (isAtom) {
                                        const updatedRaw = (_o = (_m = item.querySelector("updated")) === null || _m === void 0 ? void 0 : _m.textContent) !== null && _o !== void 0 ? _o : "";
                                        if (updatedRaw)
                                            pubDate = formatDate(new Date(updatedRaw));
                                    }
                                    else {
                                        const pubDateRaw = (_q = (_p = item.querySelector("pubDate")) === null || _p === void 0 ? void 0 : _p.textContent) !== null && _q !== void 0 ? _q : "";
                                        const pubDateObj = pubDateRaw ? new Date(pubDateRaw) : null;
                                        pubDate = pubDateObj ? formatDate(pubDateObj) : "";
                                    }
                                    try {
                                        const urlObj = new URL(link);
                                        const host = urlObj.host;
                                        const exists = storedData.some(i => i.link === link);
                                        if (exists)
                                            continue;
                                        // Validar imagen
                                        const esValida = yield validarImagen(imageUrl);
                                        if (!esValida)
                                            imageUrl = feed.defaultImage || "";
                                        storedData.push({ host, title, link, imageUrl, pubDate, type: feed.type, fromDescription: feed.useDescriptionForImage });
                                    }
                                    catch (err) {
                                        console.error("Error guardando item en localStorage:", err);
                                    }
                                }
                            }
                            catch (err) {
                                console.error("Error procesando feed:", feed.url, err);
                            }
                            finally {
                                active--;
                                next(); // Lanza la siguiente tarea
                            }
                        }))();
                    }
                });
                next();
            });
        }
        catch (err) {
            console.error("Error general en saveHistorial:", err);
        }
    });
}
export function validarImagen(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
        img.src = `${url}?_=${Date.now()}`;
    });
}
let refreshIntervalId;
function startAutoRefresh(intervalMs) {
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
    loadFeeds();
    const dt = new Date();
    const footer = document.getElementById("getCurrentDate");
    if (footer)
        footer.textContent = dt.getFullYear().toString();
    const select = document.getElementById("refreshSelect");
    if (select) {
        select.value = "300000"; // 5 minutos
        startAutoRefresh(Number(select.value));
        select.addEventListener("change", () => {
            startAutoRefresh(Number(select.value));
        });
    }
    else {
        console.error("No se encontró el select de refresco");
    }
});
function fetchWithTimeout(url_1) {
    return __awaiter(this, arguments, void 0, function* (url, options = {}, timeoutMs = 3000) {
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
