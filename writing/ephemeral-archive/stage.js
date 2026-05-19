/**
 * Ephemeral Archive — per-file stage + theme controller
 */
(function () {
    "use strict";

    const stage = document.getElementById("stage");
    if (!stage) return;

    const scenes = Array.from(stage.querySelectorAll(".stage-scene"));
    const files = Array.from(document.querySelectorAll(".archive-file[data-scene]"));
    if (files.length === 0) return;

    const knownScenes = new Set(scenes.map((s) => s.dataset.scene));
    let activeFile = "intro";
    let rafId = null;

    const visibility = new Map(files.map((f) => [f, { ratio: 0 }]));

    function normalizeScene(raw) {
        return knownScenes.has(raw) ? raw : "intro";
    }

    function applyFile(fileId) {
        const id = normalizeScene(fileId);
        if (id === activeFile) return;
        activeFile = id;
        document.body.dataset.activeFile = id;

        scenes.forEach((scene) => {
            scene.classList.toggle("is-active", scene.dataset.scene === id);
        });
    }

    function pickWinner() {
        let best = null;
        let bestRatio = 0;
        visibility.forEach((entry, file) => {
            if (entry.ratio > bestRatio) {
                bestRatio = entry.ratio;
                best = file;
            }
        });
        return best && bestRatio > 0 ? normalizeScene(best.dataset.scene) : activeFile;
    }

    function scheduleUpdate() {
        if (rafId !== null) return;
        rafId = requestAnimationFrame(() => {
            rafId = null;
            applyFile(pickWinner());
        });
    }

    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                const file = entry.target;
                const record = visibility.get(file);
                if (!record) return;
                record.ratio = entry.isIntersecting ? entry.intersectionRatio : 0;
                file.classList.toggle("is-visible", entry.intersectionRatio >= 0.32);
            });
            scheduleUpdate();
        },
        {
            root: null,
            rootMargin: "-40% 0px -40% 0px",
            threshold: [0, 0.12, 0.25, 0.4, 0.55, 0.7, 0.85, 1],
        }
    );

    files.forEach((f) => observer.observe(f));

    function init() {
        const mid = window.innerHeight * 0.5;
        let closest = files[0];
        let dist = Infinity;
        files.forEach((file) => {
            const r = file.getBoundingClientRect();
            const d = Math.abs(r.top + r.height * 0.5 - mid);
            if (d < dist) {
                dist = d;
                closest = file;
            }
        });
        applyFile(closest.dataset.scene);
        closest.classList.add("is-visible");
    }

    init();

    let resizeTimer;
    window.addEventListener(
        "resize",
        () => {
            clearTimeout(resizeTimer);
            resizeTimer = setTimeout(scheduleUpdate, 100);
        },
        { passive: true }
    );

    stage.querySelectorAll("img[src]").forEach((img) => {
        const preload = new Image();
        preload.src = img.getAttribute("src");
    });
})();
