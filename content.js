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
        '#ytqf-bar .btn{position:relative;display:inline-block;margin-right:8px;padding:6px 10px;border-radius:10px;border:1px solid #d0d6e0;cursor:pointer;background:#fff;font:500 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif}' +
        '#ytqf-bar .btn.active{background:#e6f0ff}' +
        '#ytqf-bar .ghost{opacity:.7}' +
        /* in-button delete badge */
        '#ytqf-bar .btn .del{position:absolute;top:-6px;right:-6px;width:18px;height:18px;border-radius:50%;border:1px solid #d88;background:#fdd;color:#900;font:bold 12px/16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;text-align:center;cursor:pointer;padding:0}' +

        /* modal */
        '#ytqf-modal-backdrop{position:fixed;inset:0;background:rgba(0,0,0,.25);z-index:99998}' +
        '#ytqf-modal{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;z-index:99999}' +
        '#ytqf-modal .card{min-width:420px;max-width:90vw;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 30px rgba(0,0,0,.15)}' +
        '#ytqf-modal .hdr{padding:14px 16px;font:600 16px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;border-bottom:1px solid #f0f2f5}' +
        '#ytqf-modal .body{padding:14px 16px}' +
        '#ytqf-modal label{display:block;font:600 12px system-ui,-apple-system,Segoe UI,Roboto,sans-serif;color:#536079;margin:10px 0 6px}' +
        '#ytqf-modal input{width:100%;box-sizing:border-box;padding:8px 10px;border:1px solid #d0d6e0;border-radius:8px;font:13px/1.4 ui-monospace,SFMono-Regular,Menlo,Consolas,monospace}' +
        '#ytqf-modal .f{display:flex;gap:8px;justify-content:flex-end;padding:12px 16px;border-top:1px solid #f0f2f5}' +
        '#ytqf-modal .f button{padding:8px 12px;border-radius:10px;border:1px solid #d0d6e0;background:#fff;cursor:pointer}' +
        '#ytqf-modal .f .primary{background:#1a73e8;color:#fff;border-color:#1a73e8}' +
        '#ytqf-bar .edit{margin-left:4px}';


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

    function render(bar, data, editMode) {
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
            b.textContent = it.label;

            // по клику применяем фильтр (если не в режиме редактирования)
            b.onclick = function () {
                if (!editMode) setQuery(it.query);
            };

            // крестик удаления — внутри кнопки, в правом верхнем углу
            if (editMode) {
                var del = document.createElement('span');
                del.className = 'del';
                del.textContent = '×';
                del.title = 'Delete';
                del.onclick = async function (e) {
                    e.stopPropagation(); // не триггерим выбор фильтра
                    var arr = (await get(KEY)) || dfl;
                    arr.splice(idx, 1);
                    await set({ [KEY]: arr });
                    render(bar, arr, true);
                };
                b.appendChild(del);
            }

            bar.appendChild(b);
        });

        // Clear
        var clr = document.createElement('button');
        clr.className = 'btn' + (q === '' ? ' active' : '');
        clr.textContent = 'Clear';
        clr.onclick = function () { setQuery(''); };
        bar.appendChild(clr);

        // + Add filter (модалка)
        var add = document.createElement('button');
        add.className = 'btn ghost';
        add.textContent = '+ Add filter';
        add.onclick = openModal;
        bar.appendChild(add);

        // Edit/Done (переключение режима удаления)
        var edit = document.createElement('button');
        edit.className = 'btn ghost edit';
        edit.textContent = editMode ? 'Done' : 'Edit';
        edit.onclick = async function () {
            render(bar, (await get(KEY)) || dfl, !editMode);
        };
        bar.appendChild(edit);
    }


    async function openModal() {
        var modal = document.createElement('div');
        modal.id = 'ytqf-modal';
        var back = document.createElement('div');
        back.id = 'ytqf-modal-backdrop';
        modal.innerHTML = '' +
            '<div class="card"><div class="hdr">Create quick filter</div><div class="body">' +
            '<label>Name</label><input id="ytqf-name" placeholder="Например: Костя">' +
            '<label>Query</label><input id="ytqf-query" placeholder="Assignee: k.kochetov">' +
            '</div><div class="f"><button id="ytqf-cancel">Cancel</button><button class="primary" id="ytqf-save">Create</button></div></div>';
        document.body.append(back, modal);
        function close() { back.remove(); modal.remove(); }
        back.onclick = close;
        modal.querySelector('#ytqf-cancel').onclick = close;
        modal.querySelector('#ytqf-save').onclick = async function () {
            var name = modal.querySelector('#ytqf-name').value.trim();
            var query = modal.querySelector('#ytqf-query').value.trim();
            if (!name || !query) return;
            var arr = (await get(KEY)) || dfl;
            arr.push({ label: name, query: query });
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
