(() => {
    const KEY = 'ytQuickFilters'; // [{label, query}]
    const dfl = [
        { label: 'Костя',  query: 'Assignee: k.kochetov' },
        { label: 'Толя',   query: 'Assignee: a.usievich' },
        { label: 'Руслан', query: 'Assignee: r.sibgatullin' },
        { label: 'Алла',   query: 'Assignee: a.alekseeva' }
    ];

    function get(key) {
        return new Promise(function (resolve) {
            chrome.storage.sync.get(key, function (v) { resolve(v[key]); });
        });
    }

    function set(obj) {
        return new Promise(function (resolve) {
            chrome.storage.sync.set(obj, resolve);
        });
    }

    function currentQuery() {
        return new URL(location.href).searchParams.get('query') || '';
    }

    function setQuery(q) {
        var u = new URL(location.href);
        if (q && q.trim()) {
            u.searchParams.set('query', q.trim());
        } else {
            u.searchParams.delete('query');
        }
        location.assign(u.toString());
    }

    var css = '' +
        /* toolbar & buttons */
        '#ytqf-bar{display:inline-flex;align-items:center;gap:6px;margin-right:12px}' +
        '#ytqf-bar .btn{position:relative;display:inline-flex;align-items:center;justify-content:center;margin-right:8px;padding:6px 12px;border-radius:12px;border:1px solid #d0d6e0;cursor:pointer;background:#fff;font:500 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;overflow:hidden}' +
        '#ytqf-bar .btn.active{background:#e6f0ff}' +
        '#ytqf-bar .ghost{opacity:.75}' +
        '#ytqf-bar .btn .lbl{position:relative;z-index:1}' +

        /* context menu */
        '#ytqf-menu{position:fixed;min-width:160px;background:#fff;border:1px solid #e5e7eb;border-radius:10px;box-shadow:0 8px 24px rgba(0,0,0,.12);z-index:99999;overflow:hidden}' +
        '#ytqf-menu .mi{padding:8px 12px;font:500 13px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#2d3648;cursor:pointer;white-space:nowrap}' +
        '#ytqf-menu .mi:hover{background:#f4f6f9}' +
        '#ytqf-menu .danger{color:#b00020}' +
        '#ytqf-menu .sep{height:1px;background:#eef1f4;margin:4px 0}' +

        /* modal (как было) */
        '#ytqf-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:99998}' +
        '#ytqf-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:99998}' +
        '#ytqf-modal .card{min-width:420px;max-width:90vw;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.15)}' +
        '#ytqf-modal .hdr{padding:14px 16px;font:600 16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;border-bottom:1px solid #f0f2f5}' +
        '#ytqf-modal .body{padding:14px 16px}' +
        '#ytqf-modal label{display:block;font:600 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#536079;margin:10px 0 6px}' +
        '#ytqf-modal input{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d0d6e0;border-radius:8px;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}' +
        '#ytqf-modal .f{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #f0f2f5}' +
        '#ytqf-modal .f button{padding:8px 12px;border-radius:10px;border:1px solid #d0d6e0;background:#fff;cursor:pointer}' +
        '#ytqf-modal .f .primary{background:#1a73e8;color:#fff;border-color:#1a73e8}' +
        '#ytqf-modal .f .danger{background:#ffe8e8;border-color:#ffd2d2;color:#b00020;margin-right:auto}';





    function ensureStyle() {
        if (document.getElementById('ytqf-style')) return;
        var s = document.createElement('style');
        s.id = 'ytqf-style';
        s.textContent = css;
        document.head.appendChild(s);
    }

    function mountToolbar() {
        return document.querySelector('.yt-agile-board__toolbar[data-test="yt-agile-board-toolbar"]') ||
            document.querySelector('.yt-agile-board__toolbar');
    }

    function closeMenu() {
        var m = document.getElementById('ytqf-menu');
        if (m) m.remove();
        document.removeEventListener('click', closeMenu, true);
        document.removeEventListener('contextmenu', closeMenu, true);
        window.removeEventListener('blur', closeMenu);
        window.removeEventListener('scroll', closeMenu, true);
    }

    function closeMenu() {
        var m = document.getElementById('ytqf-menu');
        if (m) m.remove();
        document.removeEventListener('click', closeMenu, true);
        document.removeEventListener('contextmenu', closeMenu, true);
        window.removeEventListener('blur', closeMenu);
        window.removeEventListener('scroll', closeMenu, true);
    }

    function closeMenu() {
        var m = document.getElementById('ytqf-menu');
        if (m) m.remove();
        document.removeEventListener('click', closeMenu, true);
        document.removeEventListener('contextmenu', closeMenu, true);
        window.removeEventListener('blur', closeMenu);
        window.removeEventListener('scroll', closeMenu, true);
    }

    function showContextMenu(x, y, item, idx) {
        closeMenu();

        function uniqueLabel(base, arr) {
            var name = base + ' (copy)';
            var n = 2;
            var labels = new Set(arr.map(function (i) { return i.label; }));
            while (labels.has(name)) { name = base + ' (copy ' + n + ')'; n++; }
            return name;
        }

        var menu = document.createElement('div');
        menu.id = 'ytqf-menu';

        // Edit…
        var miEdit = document.createElement('div');
        miEdit.className = 'mi';
        miEdit.textContent = 'Edit';
        miEdit.onclick = function (e) {
            e.stopPropagation(); closeMenu();
            openModal(item.label, item.query, idx);
        };
        menu.appendChild(miEdit);

        // Duplicate
        var miDup = document.createElement('div');
        miDup.className = 'mi';
        miDup.textContent = 'Duplicate';
        miDup.onclick = async function (e) {
            e.stopPropagation(); closeMenu();
            var arr = (await get(KEY)) || dfl;
            arr.splice(idx + 1, 0, { label: uniqueLabel(item.label, arr), query: item.query });
            await set({ [KEY]: arr });
            var bar = document.getElementById('ytqf-bar');
            if (bar) render(bar, arr, false);
        };
        menu.appendChild(miDup);

        // separator (если у тебя уже добавлен стиль .sep в css)
        var sep = document.createElement('div');
        sep.className = 'sep';
        menu.appendChild(sep);

        // Delete (без confirm)
        var miDel = document.createElement('div');
        miDel.className = 'mi danger';
        miDel.textContent = 'Delete';
        miDel.onclick = async function (e) {
            e.stopPropagation(); closeMenu();
            var arr = (await get(KEY)) || dfl;
            arr.splice(idx, 1);
            await set({ [KEY]: arr });
            var bar = document.getElementById('ytqf-bar');
            if (bar) render(bar, arr, false);
        };
        menu.appendChild(miDel);

        document.body.appendChild(menu);

        // позиционирование
        var w = menu.offsetWidth, h = menu.offsetHeight;
        var vw = window.innerWidth, vh = window.innerHeight;
        menu.style.left = Math.min(x, vw - w - 8) + 'px';
        menu.style.top  = Math.min(y, vh - h - 8) + 'px';

        setTimeout(function () {
            document.addEventListener('click', closeMenu, true);
            document.addEventListener('contextmenu', closeMenu, true);
            window.addEventListener('blur', closeMenu);
            window.addEventListener('scroll', closeMenu, true);
        }, 0);
    }




    function render(bar, data, _editModeNotUsed) {
        bar.innerHTML = '';

        var title = document.createElement('span');
        title.textContent = 'Quick Filters:';
        title.style.cssText = 'margin-right:6px;color:#536079;font:600 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;';
        bar.appendChild(title);

        var q = currentQuery().trim();

        data.forEach(function (it, idx) {
            var b = document.createElement('button');
            b.className = 'btn' + (q === it.query ? ' active' : '');
            b.title = it.query;

            var lbl = document.createElement('span');
            lbl.className = 'lbl';
            lbl.textContent = it.label;
            b.appendChild(lbl);

            // левый клик — применяем фильтр
            b.onclick = function () { setQuery(it.query); };

            // правый клик — контекстное меню (edit/delete)
            b.addEventListener('contextmenu', function (e) {
                e.preventDefault();
                e.stopPropagation();
                showContextMenu(e.clientX, e.clientY, it, idx);
            });

            bar.appendChild(b);
        });

        // Clear
        var clr = document.createElement('button');
        clr.className = 'btn' + (q === '' ? ' active' : '');
        clr.textContent = 'Clear';
        clr.onclick = function () { setQuery(''); };
        bar.appendChild(clr);

        // + Add filter
        var add = document.createElement('button');
        add.className = 'btn ghost';
        add.textContent = '+ Add filter';
        add.onclick = function () { openModal(); };
        bar.appendChild(add);

        // (кнопку Edit полностью убрали)
    }


    async function openModal(nameInit, queryInit, idx) {
        var modal = document.createElement('div');
        modal.id = 'ytqf-modal';
        var back = document.createElement('div');
        back.id = 'ytqf-modal-backdrop';

        var isEdit = typeof idx === 'number';
        var title = isEdit ? 'Edit quick filter' : 'Create quick filter';
        var nameVal = (nameInit || '').replace(/"/g, '&quot;');
        var queryVal = (queryInit || '').replace(/"/g, '&quot;');

        modal.innerHTML =
            '<div class="card">' +
            '<div class="hdr">' + title + '</div>' +
            '<div class="body">' +
            '<label>Name</label><input id="ytqf-name" placeholder="Например: Костя" value="' + nameVal + '">' +
            '<label>Query</label><input id="ytqf-query" placeholder="Assignee: k.kochetov" value="' + queryVal + '">' +
            '</div>' +
            '<div class="f">' +
            '<button id="ytqf-cancel">Cancel</button>' +
            '<button class="primary" id="ytqf-save">' + (isEdit ? 'Save' : 'Create') + '</button>' +
            '</div>' +
            '</div>';

        document.body.append(back, modal);

        function close() { try { back.remove(); modal.remove(); } catch (_) {} }
        back.onclick = close;
        modal.querySelector('#ytqf-cancel').onclick = close;

        // Save / Create
        modal.querySelector('#ytqf-save').onclick = async function () {
            var name = modal.querySelector('#ytqf-name').value.trim();
            var query = modal.querySelector('#ytqf-query').value.trim();
            if (!name || !query) return;

            var arr = (await get(KEY)) || dfl;
            if (isEdit && idx > -1 && idx < arr.length) {
                arr[idx] = { label: name, query: query };
            } else {
                arr.push({ label: name, query: query });
            }
            await set({ [KEY]: arr });
            close();
            var bar = document.getElementById('ytqf-bar');
            if (bar) render(bar, arr, false);
        };
    }



    async function inject() {
        if (document.getElementById('ytqf-bar')) return;
        ensureStyle();
        var host = mountToolbar();
        if (!host) return;
        var bar = document.createElement('div');
        bar.id = 'ytqf-bar';
        host.insertBefore(bar, host.firstChild);
        var data = (await get(KEY)) || dfl;
        render(bar, data, false);
    }

    var mo = new MutationObserver(inject);
    mo.observe(document.documentElement, { childList: true, subtree: true });
    inject();
})();
