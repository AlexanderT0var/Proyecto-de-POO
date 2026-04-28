/**
 * ProjectTrack — Sistema de Gestión de Proyectos
 * Autor: Equipo de Desarrollo (Ingeniería de Software)
 * Stack: HTML5 · CSS3 · JavaScript ES6+ · Supabase (PostgreSQL)
 *
 * Módulos:
 *  1. Configuración Supabase
 *  2. Estado global
 *  3. Controlador principal (app)
 *  4. Lógica de negocio
 *  5. Renderizado de vistas
 *  6. CRUD Proyectos
 *  7. CRUD Tareas
 *  8. CRUD Usuarios
 * 10. Utilidades (Modal, Toast, Helpers)
 */

// ═══════════════════════════════════════════════
// 1. CONFIGURACIÓN SUPABASE
// ═══════════════════════════════════════════════
const SUPABASE_URL      = 'https://qlrzkgitmhettkyuzgkr.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFscnprZ2l0bWhldHRreXV6Z2tyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcwNTk5ODksImV4cCI6MjA5MjYzNTk4OX0.JdQFhwdaHIMVnQXWbuvxx2sIBf8L3s_D5Q-NljhPpCg';
const sbClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ═══════════════════════════════════════════════
// 2. ESTADO GLOBAL
// ═══════════════════════════════════════════════
const state = {
    currentUser:            null,
    users:                  [],
    projects:               [],
    tasks:                  [],
    isRegisteringMainAdmin: false,
    currentView:            'dashboard'
};

// ═══════════════════════════════════════════════
// 3. CONTROLADOR PRINCIPAL
// ═══════════════════════════════════════════════
const app = {

    // ── Inicialización ──
    init: async () => {
        await app.checkUsersExistence();
        document.getElementById('login-form').addEventListener('submit', app.handleAuth);
    },

    // ── Verificar si existe al menos un usuario ──
    checkUsersExistence: async () => {
        const { data, error } = await sbClient.from('tb_usuario').select('id');
        if (error || !data) {
            console.error('Error al conectar con Supabase:', error);
            return;
        }
        if (data.length === 0) app.showRegisterMain();
    },

    // ── Modo registro de Admin Principal ──
    showRegisterMain: () => {
        state.isRegisteringMainAdmin = true;
        document.getElementById('login-title') && (document.getElementById('login-title').innerText = 'Crear Administrador');
        document.getElementById('name-group').style.display  = 'block';
        document.getElementById('toggle-auth').style.display = 'none';
        document.getElementById('btn-auth').innerText        = 'Crear cuenta';
    },

    // ── Autenticación ──
    handleAuth: async (e) => {
        e.preventDefault();
        const email    = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const btn      = document.getElementById('btn-auth');

        btn.disabled  = true;
        btn.innerHTML = '<span class="spin"></span>Verificando...';
        app.showLoginError('');

        if (state.isRegisteringMainAdmin) {
            const nombre = document.getElementById('reg-name').value.trim();
            if (!nombre) {
                btn.disabled = false; btn.innerText = 'Crear cuenta';
                return app.showLoginError('Ingresa tu nombre completo.');
            }
            const { data, error } = await sbClient
                .from('tb_usuario')
                .insert([{ nombre_completo: nombre, correo: email, contrasena: password, rol: 'Admin Principal' }])
                .select();

            btn.disabled = false; btn.innerText = 'Crear cuenta';
            if (error) return app.showLoginError('Error: ' + error.message);
            state.currentUser = data[0];
            await app.loginSuccess();
        } else {
            const { data, error } = await sbClient
                .from('tb_usuario')
                .select('*')
                .eq('correo', email)
                .eq('contrasena', password);

            btn.disabled = false; btn.innerText = 'Iniciar sesión';
            if (error)                          return app.showLoginError('Error de conexión: ' + error.message);
            if (!data || data.length === 0)     return app.showLoginError('Correo o contraseña incorrectos.');
            state.currentUser = data[0];
            await app.loginSuccess();
        }
    },

    showLoginError: (msg) => {
        const el = document.getElementById('login-error');
        if (!el) return;
        el.innerText      = msg;
        el.style.display  = msg ? 'block' : 'none';
    },

    // ── Post-login ──
    loginSuccess: async () => {
        document.getElementById('login-container').style.display = 'none';
        document.getElementById('app-container').style.display   = 'flex';

        const u = state.currentUser;
        const initials = u.nombre_completo.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();

        document.getElementById('active-user-name').innerText  = u.nombre_completo;
        document.getElementById('active-user-role').innerText  = u.rol;
        document.getElementById('active-user-role2').innerText = u.rol;
        document.getElementById('topbar-name').innerText       = u.nombre_completo;
        document.getElementById('user-avatar').innerText       = initials;
        document.getElementById('topbar-avatar').innerText     = initials;

        const isAdmin = u.rol === 'Admin Principal';
        document.getElementById('nav-usuarios').style.display   = isAdmin ? 'flex' : 'none';
        document.getElementById('admin-section').style.display  = isAdmin ? 'block' : 'none';

        await app.loadData();
        const firstItem = document.getElementById('nav-dashboard');
        await app.view('dashboard', firstItem);
    },

    // ── Cerrar sesión ──
    logout: () => { state.currentUser = null; window.location.reload(); },

    // ── Navegación ──
    view: async (section, sourceElement) => {
        document.querySelectorAll('.nav-item').forEach(li => li.classList.remove('active'));
        if (sourceElement) sourceElement.classList.add('active');

        state.currentView = section;
        const titles = {
            dashboard: 'Dashboard',
            proyectos: 'Proyectos',
            tareas:    'Tareas',
            usuarios:  'Usuarios'
        };
        document.getElementById('page-title').innerText = titles[section] || section;

        const content = document.getElementById('main-content');
        switch (section) {
            case 'dashboard': await app.renderDashboard(content); break;
            case 'proyectos':      app.renderProjects(content);   break;
            case 'tareas':         app.renderTasks(content);      break;
            case 'usuarios':       app.renderUsers(content);      break;
        }
    },

    // ── Cargar datos desde Supabase ──
    loadData: async () => {
        const [ur, pr, tr] = await Promise.all([
            sbClient.from('tb_usuario').select('*').order('id'),
            sbClient.from('tb_proyecto').select('*').order('id'),
            sbClient.from('tb_tarea').select('*').order('id')
        ]);
        state.users    = ur.data || [];
        state.projects = pr.data || [];
        state.tasks    = tr.data || [];
    },

    // ── Abrir/cerrar modal ──
    openModal: (html) => {
        document.getElementById('modal-box').innerHTML     = html;
        document.getElementById('modal-overlay').style.display = 'flex';
    },

    closeModal: () => {
        document.getElementById('modal-overlay').style.display = 'none';
        document.getElementById('modal-box').innerHTML = '';
    },

    // ── Toast notification ──
    toast: (msg, type = 'default') => {
        const t = document.getElementById('toast');
        const icons = { default: '✓', error: '✕', warn: '⚠' };
        const colors = { default: '#86efac', error: '#fca5a5', warn: '#fcd34d' };
        t.innerHTML = `<span style="color:${colors[type]};margin-right:8px">${icons[type]}</span>${msg}`;
        t.style.display = 'block';
        clearTimeout(t._t);
        t._t = setTimeout(() => t.style.display = 'none', 3000);
    }
};

window.onload = app.init;

// ═══════════════════════════════════════════════
// 4. LÓGICA DE NEGOCIO
// ═══════════════════════════════════════════════

// Calcula el porcentaje de progreso de un proyecto según sus tareas
app.calculateProgress = (projectId) => {
    const tasks = state.tasks.filter(t => t.id_proyecto === projectId);
    if (!tasks.length) return 0;
    const done = tasks.filter(t => t.estatus === 'Completado').length;
    const prog = tasks.filter(t => t.estatus === 'En Progreso').length;
    return Math.round((done * 100 + prog * 50) / tasks.length);
};

// Devuelve el pill HTML para un estatus de tarea
app.statusPill = (s) => {
    const map = {
        'Pendiente':   'pill-orange',
        'En Progreso': 'pill-blue',
        'Completado':  'pill-green'
    };
    return `<span class="pill ${map[s] || 'pill-gray'}">${s}</span>`;
};

// Devuelve el pill HTML para el estado de un proyecto
app.statePill = (s) => {
    const map = {
        'Activo':      'pill-green',
        'En Pausa':    'pill-orange',
        'Finalizado':  'pill-purple',
        'Cancelado':   'pill-red'
    };
    return `<span class="pill ${map[s] || 'pill-gray'}">${s || '—'}</span>`;
};

// Calcula el badge de deadline para una tarea
app.deadlineBadge = (fechaLimite) => {
    if (!fechaLimite) return '';
    const hoy  = new Date(); hoy.setHours(0,0,0,0);
    const meta = new Date(fechaLimite);
    const diff = Math.ceil((meta - hoy) / (1000 * 60 * 60 * 24));
    if (diff < 0)  return `<span class="deadline-badge deadline-overdue">⚠ Vencida</span>`;
    if (diff <= 3) return `<span class="deadline-badge deadline-soon">⏰ ${diff}d restantes</span>`;
    return `<span class="deadline-badge deadline-ok">📅 ${meta.toLocaleDateString('es-MX')}</span>`;
};

// Proyectos visibles según el rol del usuario activo
app.visibleProjects = () => {
    const u = state.currentUser;
    if (u.rol === 'Admin Principal' || u.rol === 'Administrador') return state.projects;
    const myProjIds = state.tasks.filter(t => t.id_usuario === u.id).map(t => t.id_proyecto);
    return state.projects.filter(p => myProjIds.includes(p.id));
};

// ═══════════════════════════════════════════════
// 5. DASHBOARD
// ═══════════════════════════════════════════════
app.renderDashboard = async (container) => {
    const projects = app.visibleProjects();
    const myTasks  = state.tasks.filter(t =>
        state.currentUser.rol === 'Admin Principal' ? true : t.id_usuario === state.currentUser.id
    );

    const total     = projects.length;
    const activos   = projects.filter(p => p.estado === 'Activo').length;
    const pendTasks = myTasks.filter(t => t.estatus === 'Pendiente').length;
    const doneTasks = myTasks.filter(t => t.estatus === 'Completado').length;

    // Tareas con deadline próximo (≤ 3 días)
    const urgentes = myTasks.filter(t => {
        if (!t.fecha_limite || t.estatus === 'Completado') return false;
        const diff = Math.ceil((new Date(t.fecha_limite) - new Date()) / 86400000);
        return diff >= 0 && diff <= 3;
    });

    let html = `
    <!-- Stats -->
    <div class="stats-grid">
        <div class="stat-card blue">
            <div class="stat-label">Proyectos</div>
            <div class="stat-value">${total}</div>
            <div class="stat-sub">${activos} activos</div>
        </div>
        <div class="stat-card purple">
            <div class="stat-label">Tareas totales</div>
            <div class="stat-value">${myTasks.length}</div>
            <div class="stat-sub">${doneTasks} completadas</div>
        </div>
        <div class="stat-card orange">
            <div class="stat-label">Pendientes</div>
            <div class="stat-value">${pendTasks}</div>
            <div class="stat-sub">sin iniciar</div>
        </div>
        <div class="stat-card green">
            <div class="stat-label">Completadas</div>
            <div class="stat-value">${doneTasks}</div>
            <div class="stat-sub">finalizadas</div>
        </div>
    </div>`;

    // Alertas de deadline
    if (urgentes.length > 0) {
        html += `<div style="background:rgba(245,158,11,.1);border:1px solid rgba(245,158,11,.3);
            border-radius:10px;padding:14px 18px;margin-bottom:24px">
            <div style="font-weight:600;color:#fcd34d;margin-bottom:8px">⏰ Tareas con deadline próximo (${urgentes.length})</div>`;
        urgentes.forEach(t => {
            const p = state.projects.find(x => x.id === t.id_proyecto);
            html += `<div style="font-size:13px;color:#e2e8f0;padding:4px 0;border-bottom:1px solid rgba(245,158,11,.15)">
                <strong>${t.descripcion}</strong>
                <span style="color:#94a3b8;margin-left:8px">${p ? p.nombre_proyecto : '—'}</span>
                ${app.deadlineBadge(t.fecha_limite)}
            </div>`;
        });
        html += `</div>`;
    }

    // Proyectos recientes
    html += `
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px">
        <h3 style="font-size:15px;font-weight:600;color:var(--text)">Proyectos activos</h3>
        <button class="btn btn-sm" onclick="app.view('proyectos', document.getElementById('nav-proyectos'))">Ver todos →</button>
    </div>`;

    if (projects.length === 0) {
        html += `<div class="empty-state">
            <div class="empty-state-icon">📁</div>
            <h3>Sin proyectos</h3>
            <p>Aún no hay proyectos registrados en el sistema.</p>
        </div>`;
    } else {
        html += `<div class="projects-grid">`;
        projects.slice(0, 6).forEach(p => {
            const progress = app.calculateProgress(p.id);
            const taskCount = state.tasks.filter(t => t.id_proyecto === p.id).length;
            const techs = (p.tecnologias || '').split(',').map(t => t.trim()).filter(Boolean);
            html += `
            <div class="project-card">
                <div class="project-card-header">
                    <div>
                        <div class="project-card-id">#${p.id}</div>
                        <div class="project-card-title">${p.nombre_proyecto}</div>
                    </div>
                    ${app.statePill(p.estado)}
                </div>
                <div class="project-card-desc">${p.descripcion || 'Sin descripción.'}</div>
                <div class="project-card-meta">
                    ${techs.slice(0, 3).map(t => `<span class="tech-tag">${t}</span>`).join('')}
                </div>
                <div class="progress-wrap">
                    <div class="progress-label"><span>Avance</span><span>${progress}%</span></div>
                    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
                </div>
                <div style="font-size:11px;color:var(--text-dim)">${taskCount} tarea${taskCount !== 1 ? 's' : ''}</div>
            </div>`;
        });
        html += `</div>`;
    }

    container.innerHTML = html;
};

// ═══════════════════════════════════════════════
// 6. PROYECTOS — CRUD
// ═══════════════════════════════════════════════
app.renderProjects = (container) => {
    const isAdmin = ['Admin Principal', 'Administrador'].includes(state.currentUser.rol);
    const projects = app.visibleProjects();

    let html = `
    <div class="page-header">
        <div class="page-header-left">
            <h2>Proyectos</h2>
            <p>Gestión de desarrollos activos e históricos</p>
        </div>
        <div style="display:flex;gap:8px">
            ${isAdmin ? `<button class="btn btn-primary" onclick="app.openModalNewProject()">+ Nuevo proyecto</button>` : ''}
        </div>
    </div>
    <div class="filter-row">
        <input class="filter-input" id="fp-search" placeholder="Buscar proyecto..." oninput="app.filterProjects()" />
        <select class="filter-input" id="fp-estado" onchange="app.filterProjects()">
            <option value="">Todos los estados</option>
            <option>Activo</option>
            <option>En Pausa</option>
            <option>Finalizado</option>
            <option>Cancelado</option>
        </select>
    </div>
    <div id="projects-list">`;

    html += app.buildProjectsTable(projects, isAdmin);
    html += `</div>`;
    container.innerHTML = html;
};

app.buildProjectsTable = (projects, isAdmin) => {
    if (projects.length === 0) return `
        <div class="empty-state">
            <div class="empty-state-icon">📋</div>
            <h3>Sin proyectos</h3>
            <p>No hay proyectos que coincidan con los filtros.</p>
        </div>`;

    let rows = projects.map(p => {
        const progress  = app.calculateProgress(p.id);
        const taskCount = state.tasks.filter(t => t.id_proyecto === p.id).length;
        const actions   = isAdmin
            ? `<button class="btn btn-sm" onclick="app.openModalEditProject(${p.id})">✏️</button>
               <button class="btn btn-sm btn-danger" onclick="app.deleteProject(${p.id})">🗑️</button>`
            : `<button class="btn btn-sm" onclick="app.filterTasksByProject(${p.id})">Ver tareas</button>`;
        return `<tr>
            <td class="mono">#${p.id}</td>
            <td class="bold">${p.nombre_proyecto}</td>
            <td style="font-size:12px;color:var(--text-dim)">${(p.tecnologias || '').substring(0, 28)}</td>
            <td>${app.statePill(p.estado)}</td>
            <td style="width:140px">
                <div style="display:flex;align-items:center;gap:8px">
                    <div class="progress-bar-bg" style="flex:1"><div class="progress-bar-fill" style="width:${progress}%"></div></div>
                    <span style="font-size:11px;color:var(--text-dim);white-space:nowrap">${progress}%</span>
                </div>
            </td>
            <td style="font-size:12px;color:var(--text-dim)">${taskCount}</td>
            <td>${actions}</td>
        </tr>`;
    }).join('');

    return `<div class="data-table-wrap">
        <table class="data-table">
            <thead><tr>
                <th>ID</th><th>Proyecto</th><th>Tecnologías</th>
                <th>Estado</th><th>Avance</th><th>Tareas</th><th>Acciones</th>
            </tr></thead>
            <tbody>${rows}</tbody>
        </table>
    </div>`;
};

app.filterProjects = () => {
    const q  = document.getElementById('fp-search')?.value.toLowerCase() || '';
    const st = document.getElementById('fp-estado')?.value || '';
    const isAdmin = ['Admin Principal', 'Administrador'].includes(state.currentUser.rol);
    const filtered = app.visibleProjects().filter(p =>
        (!q  || p.nombre_proyecto.toLowerCase().includes(q) || (p.tecnologias || '').toLowerCase().includes(q)) &&
        (!st || p.estado === st)
    );
    const el = document.getElementById('projects-list');
    if (el) el.innerHTML = app.buildProjectsTable(filtered, isAdmin);
};

// Modal nuevo proyecto
app.openModalNewProject = () => {
    app.openModal(`
        <div class="modal-title">➕ Nuevo proyecto</div>
        <div class="field-group"><label>Nombre del proyecto *</label>
            <input id="m-nombre" placeholder="Ej. Sistema de Inventarios" /></div>
        <div class="field-group"><label>Descripción</label>
            <textarea id="m-desc" placeholder="Descripción general del proyecto..."></textarea></div>
        <div class="field-group"><label>Tecnologías</label>
            <input id="m-techs" placeholder="HTML, CSS, JavaScript" /></div>
        <div class="field-group"><label>Fecha de inicio</label>
            <input type="date" id="m-fecha" /></div>
        <div class="field-group"><label>Estado</label>
            <select id="m-estado">
                <option>Activo</option><option>En Pausa</option>
                <option>Finalizado</option><option>Cancelado</option>
            </select></div>
        <div class="modal-footer">
            <button class="btn" onclick="app.closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="app.saveNewProject()">Crear proyecto</button>
        </div>`);
};

app.saveNewProject = async () => {
    const nombre = document.getElementById('m-nombre').value.trim();
    if (!nombre) return app.toast('El nombre es obligatorio.', 'error');
    if (state.projects.find(p => p.nombre_proyecto.toLowerCase() === nombre.toLowerCase()))
        return app.toast('Ya existe un proyecto con ese nombre.', 'error');

    const data = {
        nombre_proyecto: nombre,
        descripcion:     document.getElementById('m-desc').value.trim(),
        tecnologias:     document.getElementById('m-techs').value.trim(),
        fecha_inicio:    document.getElementById('m-fecha').value || new Date().toISOString().split('T')[0],
        estado:          document.getElementById('m-estado').value
    };

    const { data: res, error } = await sbClient.from('tb_proyecto').insert([data]).select();
    if (error) return app.toast('Error: ' + error.message, 'error');
    state.projects.push(res[0]);
    app.closeModal();
    app.renderProjects(document.getElementById('main-content'));
    app.toast('Proyecto creado correctamente ✓');
};

// Modal editar proyecto
app.openModalEditProject = (id) => {
    const p = state.projects.find(x => x.id === id);
    if (!p) return;
    app.openModal(`
        <div class="modal-title">✏️ Editar proyecto</div>
        <div class="field-group"><label>Nombre *</label>
            <input id="m-nombre" value="${p.nombre_proyecto}" /></div>
        <div class="field-group"><label>Descripción</label>
            <textarea id="m-desc">${p.descripcion || ''}</textarea></div>
        <div class="field-group"><label>Tecnologías</label>
            <input id="m-techs" value="${p.tecnologias || ''}" /></div>
        <div class="field-group"><label>Estado</label>
            <select id="m-estado">
                ${['Activo','En Pausa','Finalizado','Cancelado'].map(s =>
                    `<option ${p.estado === s ? 'selected' : ''}>${s}</option>`).join('')}
            </select></div>
        <div class="modal-footer">
            <button class="btn" onclick="app.closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="app.saveEditProject(${id})">Guardar cambios</button>
        </div>`);
};

app.saveEditProject = async (id) => {
    const nombre = document.getElementById('m-nombre').value.trim();
    if (!nombre) return app.toast('El nombre es obligatorio.', 'error');
    const data = {
        nombre_proyecto: nombre,
        descripcion:     document.getElementById('m-desc').value.trim(),
        tecnologias:     document.getElementById('m-techs').value.trim(),
        estado:          document.getElementById('m-estado').value
    };
    const { error } = await sbClient.from('tb_proyecto').update(data).eq('id', id);
    if (error) return app.toast('Error: ' + error.message, 'error');
    const idx = state.projects.findIndex(x => x.id === id);
    if (idx > -1) Object.assign(state.projects[idx], data);
    app.closeModal();
    app.renderProjects(document.getElementById('main-content'));
    app.toast('Proyecto actualizado ✓');
};

app.deleteProject = async (id) => {
    if (!confirm('¿Eliminar este proyecto y todas sus tareas asociadas?')) return;
    const { error } = await sbClient.from('tb_proyecto').delete().eq('id', id);
    if (error) return app.toast('Error: ' + error.message, 'error');
    state.projects = state.projects.filter(p => p.id !== id);
    state.tasks    = state.tasks.filter(t => t.id_proyecto !== id);
    app.renderProjects(document.getElementById('main-content'));
    app.toast('Proyecto eliminado.');
};

app.filterTasksByProject = (projectId) => {
    const nav = document.getElementById('nav-tareas');
    app.view('tareas', nav).then(() => {
        const sel = document.getElementById('ft-project');
        if (sel) { sel.value = projectId; app.filterTasks(); }
    });
};

// ═══════════════════════════════════════════════
// 7. TAREAS — CRUD + KANBAN
// ═══════════════════════════════════════════════
app.renderTasks = (container) => {
    const isAdmin = ['Admin Principal', 'Administrador'].includes(state.currentUser.rol);

    const projOptions = state.projects.map(p =>
        `<option value="${p.id}">${p.nombre_proyecto.substring(0, 40)}</option>`).join('');
    const userOptions = state.users.filter(u => u.rol !== 'Admin Principal').map(u =>
        `<option value="${u.id}">${u.nombre_completo}</option>`).join('');

    let html = `
    <div class="page-header">
        <div class="page-header-left">
            <h2>Tareas</h2>
            <p>Tablero Kanban de actividades</p>
        </div>
        <div style="display:flex;gap:8px">
            <button class="btn btn-primary" onclick="app.openModalNewTask()">+ Nueva tarea</button>
        </div>
    </div>
    <div class="filter-row">
        <select class="filter-input" id="ft-project" onchange="app.filterTasks()">
            <option value="">Todos los proyectos</option>${projOptions}
        </select>
        ${isAdmin ? `<select class="filter-input" id="ft-user" onchange="app.filterTasks()">
            <option value="">Todos los usuarios</option>${userOptions}
        </select>` : ''}
    </div>
    <div id="kanban-container">`;

    html += app.buildKanban(isAdmin, null, null);
    html += `</div>`;
    container.innerHTML = html;
};

app.buildKanban = (isAdmin, projectFilter, userFilter) => {
    const pf = projectFilter || (document.getElementById('ft-project') ? parseInt(document.getElementById('ft-project').value) || null : null);
    const uf = userFilter    || (document.getElementById('ft-user')    ? parseInt(document.getElementById('ft-user').value)    || null : null);

    let tasks = state.tasks.filter(t => {
        const matchP = !pf || t.id_proyecto === pf;
        const matchU = !uf || t.id_usuario === uf;
        const mine   = isAdmin || t.id_usuario === state.currentUser.id;
        return matchP && matchU && mine;
    });

    const cols = { 'Pendiente': [], 'En Progreso': [], 'Completado': [] };
    tasks.forEach(t => { if (cols[t.estatus]) cols[t.estatus].push(t); else cols['Pendiente'].push(t); });

    const colCfg = [
        { key: 'Pendiente',   label: 'Pendiente',   color: '#f59e0b', bg: 'rgba(245,158,11,.12)'  },
        { key: 'En Progreso', label: 'En Progreso',  color: '#3b82f6', bg: 'rgba(59,130,246,.12)'  },
        { key: 'Completado',  label: 'Completado',   color: '#22c55e', bg: 'rgba(34,197,94,.12)'   }
    ];

    let html = `<div class="kanban-board">`;
    colCfg.forEach(col => {
        const list = cols[col.key];
        html += `
        <div class="kanban-col">
            <div class="kanban-col-header">
                <span class="kanban-col-title" style="color:${col.color}">${col.label}</span>
                <span class="kanban-count" style="background:${col.bg};color:${col.color}">${list.length}</span>
            </div>`;
        if (list.length === 0) {
            html += `<div class="kanban-empty">Sin tareas aquí</div>`;
        } else {
            list.forEach(t => {
                const proj = state.projects.find(p => p.id === t.id_proyecto);
                const user = state.users.find(u => u.id === t.id_usuario);
                const canEdit = isAdmin || t.id_usuario === state.currentUser.id;
                const actions = canEdit ? `
                    ${t.estatus !== 'Pendiente'   ? `<button class="kbtn kbtn-pend" onclick="app.updateTaskStatus(${t.id},'Pendiente')">Pendiente</button>`   : ''}
                    ${t.estatus !== 'En Progreso' ? `<button class="kbtn kbtn-prog" onclick="app.updateTaskStatus(${t.id},'En Progreso')">En Progreso</button>` : ''}
                    ${t.estatus !== 'Completado'  ? `<button class="kbtn kbtn-done" onclick="app.updateTaskStatus(${t.id},'Completado')">Completado</button>`   : ''}
                ` : '';
                const delBtn = isAdmin ? `<button class="kbtn kbtn-del" onclick="app.deleteTask(${t.id})">🗑</button>` : '';
                html += `
                <div class="kanban-card">
                    <div class="kanban-card-id">#${t.id}</div>
                    <div class="kanban-card-project">${proj ? proj.nombre_proyecto.substring(0, 38) : '—'}</div>
                    <div class="kanban-card-desc">${t.descripcion}</div>
                    <div class="kanban-card-user">👤 ${user ? user.nombre_completo : '—'}</div>
                    <div class="kanban-card-footer">
                        <div class="kanban-actions">${actions}</div>
                        <div style="display:flex;align-items:center;gap:6px">
                            ${app.deadlineBadge(t.fecha_limite)}
                            ${isAdmin ? `<button class="kbtn" style="background:rgba(139,92,246,.15);color:#c4b5fd" onclick="app.openModalEditTask(${t.id})">✏️</button>` : ''}
                            ${delBtn}
                        </div>
                    </div>
                </div>`;
            });
        }
        html += `</div>`;
    });
    html += `</div>`;
    return html;
};

app.filterTasks = () => {
    const isAdmin = ['Admin Principal', 'Administrador'].includes(state.currentUser.rol);
    const el = document.getElementById('kanban-container');
    if (el) el.innerHTML = app.buildKanban(isAdmin, null, null);
};

// Cambiar estatus de tarea
app.updateTaskStatus = async (id, status) => {
    const { error } = await sbClient.from('tb_tarea').update({ estatus: status }).eq('id', id);
    if (error) return app.toast('Error: ' + error.message, 'error');
    const t = state.tasks.find(x => x.id === id);
    if (t) t.estatus = status;
    app.filterTasks();
    if (state.currentView === 'dashboard') app.renderDashboard(document.getElementById('main-content'));
    app.toast(`Tarea marcada como "${status}" ✓`);
};

// Modal nueva tarea
app.openModalNewTask = () => {
    const projOpts = state.projects.map(p =>
        `<option value="${p.id}">${p.nombre_proyecto.substring(0, 44)}</option>`).join('');
    const devOpts  = state.users.filter(u => u.rol === 'Desarrollador').map(u =>
        `<option value="${u.id}">${u.nombre_completo}</option>`).join('');

    app.openModal(`
        <div class="modal-title">➕ Nueva tarea</div>
        <div class="field-group"><label>Proyecto *</label>
            <select id="m-proj">${projOpts}</select></div>
        <div class="field-group"><label>Desarrollador asignado *</label>
            <select id="m-user">${devOpts || '<option value="">Sin desarrolladores</option>'}</select></div>
        <div class="field-group"><label>Descripción *</label>
            <textarea id="m-desc" placeholder="Instrucción detallada de la actividad..."></textarea></div>
        <div class="field-group"><label>Estatus</label>
            <select id="m-status">
                <option>Pendiente</option><option>En Progreso</option><option>Completado</option>
            </select></div>
        <div class="field-group"><label>Fecha límite (deadline)</label>
            <input type="date" id="m-deadline" /></div>
        <div class="modal-footer">
            <button class="btn" onclick="app.closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="app.saveNewTask()">Crear tarea</button>
        </div>`);
};

app.saveNewTask = async () => {
    const desc  = document.getElementById('m-desc').value.trim();
    const projId = parseInt(document.getElementById('m-proj').value);
    const userId = parseInt(document.getElementById('m-user').value);
    if (!desc)   return app.toast('La descripción es obligatoria.', 'error');
    if (!userId) return app.toast('Asigna un desarrollador.', 'error');

    const data = {
        id_proyecto:  projId,
        id_usuario:   userId,
        descripcion:  desc,
        estatus:      document.getElementById('m-status').value,
        fecha_limite: document.getElementById('m-deadline').value || null
    };
    const { data: res, error } = await sbClient.from('tb_tarea').insert([data]).select();
    if (error) return app.toast('Error: ' + error.message, 'error');
    state.tasks.push(res[0]);
    app.closeModal();
    app.renderTasks(document.getElementById('main-content'));
    app.toast('Tarea creada ✓');
};

// Modal editar tarea
app.openModalEditTask = (id) => {
    const t = state.tasks.find(x => x.id === id);
    if (!t) return;
    const projOpts = state.projects.map(p =>
        `<option value="${p.id}" ${p.id === t.id_proyecto ? 'selected' : ''}>${p.nombre_proyecto.substring(0, 44)}</option>`).join('');
    const devOpts  = state.users.filter(u => u.rol === 'Desarrollador').map(u =>
        `<option value="${u.id}" ${u.id === t.id_usuario ? 'selected' : ''}>${u.nombre_completo}</option>`).join('');

    app.openModal(`
        <div class="modal-title">✏️ Editar tarea</div>
        <div class="field-group"><label>Proyecto</label>
            <select id="m-proj">${projOpts}</select></div>
        <div class="field-group"><label>Desarrollador</label>
            <select id="m-user">${devOpts}</select></div>
        <div class="field-group"><label>Descripción</label>
            <textarea id="m-desc">${t.descripcion}</textarea></div>
        <div class="field-group"><label>Estatus</label>
            <select id="m-status">
                ${['Pendiente','En Progreso','Completado'].map(s =>
                    `<option ${t.estatus === s ? 'selected':''}>${s}</option>`).join('')}
            </select></div>
        <div class="field-group"><label>Fecha límite</label>
            <input type="date" id="m-deadline" value="${t.fecha_limite || ''}" /></div>
        <div class="modal-footer">
            <button class="btn" onclick="app.closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="app.saveEditTask(${id})">Guardar</button>
        </div>`);
};

app.saveEditTask = async (id) => {
    const desc = document.getElementById('m-desc').value.trim();
    if (!desc) return app.toast('La descripción es obligatoria.', 'error');
    const data = {
        id_proyecto:  parseInt(document.getElementById('m-proj').value),
        id_usuario:   parseInt(document.getElementById('m-user').value),
        descripcion:  desc,
        estatus:      document.getElementById('m-status').value,
        fecha_limite: document.getElementById('m-deadline').value || null
    };
    const { error } = await sbClient.from('tb_tarea').update(data).eq('id', id);
    if (error) return app.toast('Error: ' + error.message, 'error');
    const idx = state.tasks.findIndex(x => x.id === id);
    if (idx > -1) Object.assign(state.tasks[idx], data);
    app.closeModal();
    app.renderTasks(document.getElementById('main-content'));
    app.toast('Tarea actualizada ✓');
};

app.deleteTask = async (id) => {
    if (!confirm('¿Eliminar esta tarea?')) return;
    const { error } = await sbClient.from('tb_tarea').delete().eq('id', id);
    if (error) return app.toast('Error: ' + error.message, 'error');
    state.tasks = state.tasks.filter(t => t.id !== id);
    app.filterTasks();
    app.toast('Tarea eliminada.');
};

// ═══════════════════════════════════════════════
// 8. USUARIOS — CRUD
// ═══════════════════════════════════════════════
app.renderUsers = (container) => {
    if (state.currentUser.rol !== 'Admin Principal') return;

    let html = `
    <div class="page-header">
        <div class="page-header-left">
            <h2>Usuarios</h2>
            <p>Control de acceso y roles del sistema</p>
        </div>
        <button class="btn btn-primary" onclick="app.openModalNewUser()">+ Nuevo usuario</button>
    </div>
    <div class="users-grid">`;

    state.users.forEach(u => {
        const initials = u.nombre_completo.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
        const isMe     = u.id === state.currentUser.id;
        const roleColors = {
            'Admin Principal': 'pill-purple',
            'Administrador':   'pill-blue',
            'Desarrollador':   'pill-green'
        };
        html += `
        <div class="user-card">
            <div class="user-card-avatar">${initials}</div>
            <div style="flex:1;min-width:0">
                <div class="user-card-name">${u.nombre_completo} ${isMe ? '<span style="font-size:10px;color:var(--text-dim)">(tú)</span>' : ''}</div>
                <div class="user-card-email">${u.correo}</div>
                <div style="margin-top:6px"><span class="pill ${roleColors[u.rol] || 'pill-gray'}">${u.rol}</span></div>
            </div>
            ${!isMe ? `<div class="user-card-actions">
                <button class="btn btn-sm btn-danger" onclick="app.deleteUser(${u.id})">🗑️</button>
            </div>` : ''}
        </div>`;
    });

    html += `</div>`;
    container.innerHTML = html;
};

app.openModalNewUser = () => {
    app.openModal(`
        <div class="modal-title">➕ Nuevo usuario</div>
        <div class="field-group"><label>Nombre completo *</label>
            <input id="m-nombre" placeholder="Nombre y apellido" /></div>
        <div class="field-group"><label>Correo electrónico *</label>
            <input type="email" id="m-correo" placeholder="correo@empresa.com" /></div>
        <div class="field-group"><label>Contraseña *</label>
            <input type="password" id="m-pass" placeholder="Mínimo 6 caracteres" /></div>
        <div class="field-group"><label>Rol</label>
            <select id="m-rol">
                <option>Desarrollador</option>
                <option>Administrador</option>
                <option>Admin Principal</option>
            </select></div>
        <div class="modal-footer">
            <button class="btn" onclick="app.closeModal()">Cancelar</button>
            <button class="btn btn-primary" onclick="app.saveNewUser()">Crear usuario</button>
        </div>`);
};

app.saveNewUser = async () => {
    const nombre = document.getElementById('m-nombre').value.trim();
    const correo = document.getElementById('m-correo').value.trim();
    const pass   = document.getElementById('m-pass').value;
    if (!nombre || !correo || !pass) return app.toast('Todos los campos son obligatorios.', 'error');
    if (state.users.find(u => u.correo === correo)) return app.toast('Ya existe un usuario con ese correo.', 'error');

    const data = { nombre_completo: nombre, correo, contrasena: pass, rol: document.getElementById('m-rol').value };
    const { data: res, error } = await sbClient.from('tb_usuario').insert([data]).select();
    if (error) return app.toast('Error: ' + error.message, 'error');
    state.users.push(res[0]);
    app.closeModal();
    app.renderUsers(document.getElementById('main-content'));
    app.toast('Usuario creado ✓');
};

app.deleteUser = async (id) => {
    if (id === state.currentUser.id) return app.toast('No puedes eliminar tu propia cuenta.', 'error');
    if (!confirm('¿Eliminar este usuario?')) return;
    const { error } = await sbClient.from('tb_usuario').delete().eq('id', id);
    if (error) return app.toast('Error: ' + error.message, 'error');
    state.users = state.users.filter(u => u.id !== id);
    app.renderUsers(document.getElementById('main-content'));
    app.toast('Usuario eliminado.');
};
