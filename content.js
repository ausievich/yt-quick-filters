(() => {
    const KEY = 'ytQuickFilters'; // [{label, query}]
    const dfl = [
        { label: 'My Tasks',  query: 'Assignee: me' }
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

        // Clear (не имеет состояния active)
        var clr = document.createElement('button');
        clr.className = 'btn ghost'; // всегда как "второстепенная"
        clr.textContent = 'Clear';
        clr.onclick = function () { setQuery(''); };
        bar.appendChild(clr);

        // Add filter
        var add = document.createElement('button');
        add.className = 'btn ghost';
        add.textContent = 'Add filter...';
        add.onclick = function () { openModal(); };
        bar.appendChild(add);

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
            '<label>Name</label><input id="ytqf-name" placeholder="For example: My tasks" value="' + nameVal + '">' +
            '<label>Query</label><input id="ytqf-query" placeholder="Assignee: me" value="' + queryVal + '">' +
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
