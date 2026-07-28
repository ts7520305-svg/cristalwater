const fs = require('fs');
const path = require('path');

require('../src/loadEnv')();

const DEFAULT_BASE_URL = process.env.CW_BASE_URL || process.env.BASE_URL || 'http://127.0.0.1:3002';
const ROOT = path.join(__dirname, '..');
const VIEWPORTS = [
	{ label: 'desktop', width: 1440, height: 900 },
	{ label: 'tablet', width: 1024, height: 1366 },
	{ label: 'mobile', width: 390, height: 844 },
];

function parseArgs(argv) {
	const args = {};
	for (let i = 0; i < argv.length; i += 1) {
		const token = argv[i];
		if (!token.startsWith('--')) continue;
		const key = token.slice(2);
		const isListKey = key === 'pages' || key === 'routes';
		if (isListKey) {
			const values = [];
			let j = i + 1;
			while (j < argv.length && !argv[j].startsWith('--')) {
				values.push(argv[j]);
				j += 1;
			}
			args[key] = values;
			i = j - 1;
			continue;
		}

		const value = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : 'true';
		args[key] = value;
		if (value !== 'true') i += 1;
	}
	return args;
}

function parseListArg(value) {
	if (Array.isArray(value)) {
		return value.map((v) => String(v || '').trim()).filter(Boolean);
	}
	if (typeof value !== 'string') return [];
	return value
		.split(',')
		.map((v) => v.trim())
		.filter(Boolean);
}

function resolvePageRouteTargets(args) {
	const pages = parseListArg(args.pages);
	const routes = parseListArg(args.routes);
	const singlePage = String(args.page || '').trim();
	const singleRoute = String(args.route || '').trim();

	if (singlePage || singleRoute) {
		if (!singlePage || !singleRoute) {
			throw new Error('Quando usar --page, tambem e obrigatorio informar --route.');
		}
		return [{ page: singlePage, route: singleRoute }];
	}

	if (pages.length === 0 || routes.length === 0) {
		throw new Error('Uso: --page <slug> --route </rota> ou --pages <p1 p2 p3 p4> --routes </r1 /r2 /r3 /r4>');
	}

	if (pages.length !== routes.length) {
		throw new Error(`Quantidade invalida: pages=${pages.length} e routes=${routes.length}.`);
	}

	if (pages.length > 4) {
		throw new Error('Limite excedido: use no maximo 4 paginas por lote.');
	}

	return pages.map((page, idx) => ({ page, route: routes[idx] }));
}

function ensureDir(dirPath) {
	fs.mkdirSync(dirPath, { recursive: true });
}

function sanitize(text) {
	return String(text || '')
		.replace(/Bearer\s+[A-Za-z0-9\-._~+/]+=*/g, 'Bearer ***')
		.replace(/[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{24,}\.[A-Za-z0-9_\-]{12,}/g, '***.***.***')
		.slice(0, 280);
}

async function getAdminSession() {
	const baseUrl = String(process.env.GROUP5_EVIDENCE_BASE_URL || DEFAULT_BASE_URL).trim();
	const email = String(process.env.ADMIN_EMAIL || '').trim();
	const password = String(process.env.ADMIN_PASSWORD || '').trim();

	if (!email || !password) {
		throw new Error('ADMIN_EMAIL/ADMIN_PASSWORD nao definidos.');
	}

	const response = await fetch(`${baseUrl}/api/auth/login`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ email, password }),
	});

	const data = await response.json().catch(() => ({}));
	if (!response.ok || !data.token) {
		throw new Error(`Falha no login admin: HTTP ${response.status}`);
	}

	return {
		token: data.token,
		user: data.user || { role: 'ADMIN', email },
	};
}

function getOutDir(phase, page) {
	return path.join(ROOT, 'docs', 'product', 'evidence', 'group5', phase, page);
}

function writeCodeEvidence(phase, page) {
	const outDir = getOutDir(phase, page);
	const htmlSource = path.join(ROOT, 'frontend', `${page}.html`);
	const jsSource = path.join(ROOT, 'frontend', `${page}.js`);
	const htmlOut = path.join(outDir, `${page}.${phase}.html`);
	const jsOut = path.join(outDir, `${page}.${phase}.js`);

	if (!fs.existsSync(htmlSource)) {
		throw new Error(`Fonte HTML ausente para evidencia: ${htmlSource}`);
	}

	fs.writeFileSync(htmlOut, fs.readFileSync(htmlSource, 'utf8'));

	if (fs.existsSync(jsSource)) {
		fs.writeFileSync(jsOut, fs.readFileSync(jsSource, 'utf8'));
		return;
	}

	fs.writeFileSync(jsOut, '// Evidence-only placeholder: page uses inline scripts or shared bundles.\n');
}

function ensureBeforeIsImmutable(targets) {
	if (!targets || targets.length === 0) return;

	for (const target of targets) {
		const beforeDir = getOutDir('before', target.page);
		if (fs.existsSync(path.join(beforeDir, 'playwright-before.json'))) {
			throw new Error(`BEFORE_IMUTAVEL: evidencia before ja finalizada para ${target.page}. Nao sobrescrever BEFORE apos iniciar migracao.`);
		}
	}
}

async function run() {
	const args = parseArgs(process.argv.slice(2));
	const phase = String(args.phase || '').trim();
	const baseUrl = String(args['base-url'] || DEFAULT_BASE_URL).trim();
	const targets = resolvePageRouteTargets(args);

	if (!phase) {
		throw new Error('Uso: node scripts/group5-page-evidence.js --page admin-menu --route /admin-menu --phase before|after');
	}

	if (!['before', 'after'].includes(phase)) {
		throw new Error('Parametro --phase deve ser before ou after.');
	}

	if (phase === 'before') {
		ensureBeforeIsImmutable(targets);
	}

	let chromium;
	try {
		({ chromium } = require('playwright'));
	} catch (_) {
		throw new Error('Playwright nao encontrado nas dependencias.');
	}

	const session = await getAdminSession();
	for (const target of targets) {
		ensureDir(getOutDir(phase, target.page));
	}

	const browser = await chromium.launch({ headless: true });
	const context = await browser.newContext({ colorScheme: 'light' });
	const summaries = [];

	try {
		for (const target of targets) {
			const checks = [];
			const outDir = getOutDir(phase, target.page);
			writeCodeEvidence(phase, target.page);

			for (const vp of VIEWPORTS) {
				const page = await context.newPage({ viewport: { width: vp.width, height: vp.height } });
				const consoleErrors = [];
				const failedRequests = [];
				const httpErrors = [];
				let mainStatus = 0;

				await page.addInitScript((payload) => {
					localStorage.clear();
					sessionStorage.clear();
					localStorage.setItem('token', payload.token);
					localStorage.setItem('cristalwater_jwt', payload.token);
					localStorage.setItem('user', JSON.stringify(payload.user));
					localStorage.setItem('cristalwater_user', JSON.stringify(payload.user));
				}, session);

				page.on('console', (msg) => {
					if (msg.type() !== 'error') return;
					const text = msg.text() || '';
					if (/favicon|sw\.js|websocket|socket\.io/i.test(text)) return;
					consoleErrors.push(sanitize(text));
				});

				page.on('requestfailed', (req) => {
					const failure = req.failure() || {};
					const err = String(failure.errorText || '');
					if (/ERR_ABORTED|aborted/i.test(err)) return;
					failedRequests.push(`${req.method()} ${req.url()}`.slice(0, 280));
				});

				page.on('response', (res) => {
					const status = res.status();
					if (status >= 400) {
						const url = res.url();
						if (!/favicon\.ico$/i.test(url)) {
							httpErrors.push(`${status} ${url}`.slice(0, 280));
						}
					}
				});

				const targetUrl = `${baseUrl}${target.route}`;
				let navigationError = '';
				try {
					const response = await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
					mainStatus = response ? Number(response.status() || 0) : 0;
				} catch (error) {
					navigationError = String(error && error.message ? error.message : error);
				}

				await page.waitForTimeout(1200);

				const metrics = await page.evaluate(() => {
					const root = document.documentElement;
					const horizontalScroll = root.scrollWidth > root.clientWidth + 1;
					const mainRoot = document.querySelector('main') || document.body;
					const labels = Array.from(document.querySelectorAll('input,select,textarea')).filter((el) => {
						const rect = el.getBoundingClientRect();
						if (rect.width <= 0 || rect.height <= 0) return false;
						const style = window.getComputedStyle(el);
						if (style.display === 'none' || style.visibility === 'hidden') return false;
						const id = el.id;
						const byFor = id ? document.querySelector(`label[for="${CSS.escape(id)}"]`) : null;
						const wrapped = el.closest('label');
						const aria = el.getAttribute('aria-label') || el.getAttribute('aria-labelledby');
						return !(byFor || wrapped || aria);
					}).length;

					const operationalTargets = Array.from(mainRoot.querySelectorAll('a[href],button,input:not([type="hidden"]),select,textarea,[role="button"],[role="link"],[data-cw-action],[data-edit-visit]')).filter((el) => {
						if (el.closest('[hidden],[aria-hidden="true"]')) return false;
						const style = window.getComputedStyle(el);
						if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity || '1') < 0.6) return false;
						const rect = el.getBoundingClientRect();
						if (rect.width <= 0 || rect.height <= 0) return false;
						if (rect.bottom < 0 || rect.top > window.innerHeight) return false;
						return true;
					});

					const smallOperationalTouchTargets = operationalTargets.filter((el) => {
						const rect = el.getBoundingClientRect();
						return rect.width < 44 || rect.height < 44;
					}).length;

					return {
						title: document.title,
						horizontalScroll,
						unlabeledVisibleFields: labels,
						smallOperationalTouchTargets,
						scrollWidth: root.scrollWidth,
						viewport: root.clientWidth,
					};
				});

				const screenshotPath = path.join(outDir, `${vp.label}.png`);
				await page.screenshot({ path: screenshotPath, fullPage: true });

				checks.push({
					page: target.page,
					route: target.route,
					phase,
					status: mainStatus,
					viewport: vp,
					navigationError,
					metrics,
					consoleErrors: [...new Set(consoleErrors)].slice(0, 10),
					failedRequests: [...new Set(failedRequests)].slice(0, 10),
					httpErrors: [...new Set(httpErrors)].slice(0, 10),
				});

				await page.close();
			}

			const summary = {
				generatedAt: new Date().toISOString(),
				page: target.page,
				route: target.route,
				baseUrl,
				phase,
				totals: {
					checks: checks.length,
					statusNot200: checks.filter((c) => Number(c.status) !== 200).length,
					navigationErrors: checks.filter((c) => c.navigationError).length,
					horizontalScroll: checks.filter((c) => c.metrics.horizontalScroll).length,
					unlabeledVisibleFields: checks.reduce((sum, c) => sum + Number(c.metrics.unlabeledVisibleFields || 0), 0),
					smallOperationalTouchTargets: checks.reduce((sum, c) => sum + Number(c.metrics.smallOperationalTouchTargets || 0), 0),
					consoleErrors: checks.reduce((sum, c) => sum + c.consoleErrors.length, 0),
					failedRequests: checks.reduce((sum, c) => sum + c.failedRequests.length, 0),
					httpErrors: checks.reduce((sum, c) => sum + c.httpErrors.length, 0),
				},
				checks,
			};

			fs.writeFileSync(path.join(outDir, `playwright-${phase}.json`), JSON.stringify(summary, null, 2));
			summaries.push({ page: target.page, totals: summary.totals });
		}
	} finally {
		await context.close();
		await browser.close();
	}

	for (const item of summaries) {
		console.log(`[${item.page}]`);
		console.log(JSON.stringify(item.totals, null, 2));
	}
}

run().catch((error) => {
	console.error(error && error.stack ? error.stack : (error.message || error));
	process.exit(1);
});
