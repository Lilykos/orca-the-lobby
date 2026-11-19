// The DEMO dataset for the `media` scenario: made-up projects, people and tasks, nothing from a real machine.
// Loaded into the fixture page before fixture.js; `window.DEMO.build(now)` returns the plugin's snapshot shape
// (src/protocol.ts) plus the friendly names and the drawer actions the stubbed worker would answer with.
window.DEMO = (() => {
  const MIN = 60000
  const day = (now) => new Date(now).toISOString().slice(0, 10)

  /** A tool call, as the worker reports it: `ago` minutes since it started, `took` seconds long (or still running). */
  const call = (now, id, tool, kind, detail, ago, took) => ({
    callId: id,
    tool,
    kind,
    detail,
    startedAt: now - ago * MIN,
    ...(took === undefined ? {} : { endedAt: now - ago * MIN + took * 1000 })
  })

  const usage = (input, output, cacheRead, cacheWrite, models) => ({ input, output, cacheRead, cacheWrite, models })

  /** `opts.fresh`: the finished agents have only just finished (their bubbles show); `opts.only`: project folders to keep. */
  function build(now, opts = {}) {
    const projects = {
      '/demo/atlas-web': 'Atlas web app · local',
      '/demo/beacon-api': 'Beacon API · local',
      '/demo/compass-docs': 'Compass docs · local',
      '/demo/drift-mobile': 'Drift mobile app · local'
    }
    // Workspace (worktree) paths and the names Orca gives them.
    const workspaces = {
      '/demo/atlas-web': 'atlas-web',
      '/demo/atlas-web-checkout-validation': 'checkout-validation',
      '/demo/atlas-web-cart-a11y': 'cart-a11y',
      '/demo/atlas-web-checkout-e2e': 'checkout-e2e',
      '/demo/beacon-api': 'beacon-api',
      '/demo/beacon-api-pagination': 'orders-pagination',
      '/demo/beacon-api-invoice-rounding': 'invoice-rounding',
      '/demo/beacon-api-uuid-keys': 'uuid-keys',
      '/demo/beacon-api-webhook-keys': 'webhook-keys',
      '/demo/compass-docs': 'compass-docs',
      '/demo/compass-docs-getting-started': 'getting-started',
      '/demo/compass-docs-link-check': 'link-check',
      '/demo/compass-docs-code-dark': 'code-samples-dark',
      '/demo/drift-mobile': 'drift-mobile',
      '/demo/drift-mobile-rn-upgrade': 'rn-upgrade'
    }
    const base = {
      terminalId: null,
      prompt: null,
      reply: null,
      outcome: null,
      unread: false,
      finishedAt: null,
      parentPaneKey: null,
      parentId: null,
      active: [],
      recent: [],
      toolCount: 0,
      helpers: [],
      family: [],
      insight: null,
      context: null,
      history: []
    }
    const agent = (id, spec) => {
      const stateStartedAt = now - (spec.inState ?? 8) * MIN
      return {
        ...base,
        id,
        paneKey: id,
        workspaceId: spec.workspace,
        projectId: spec.project,
        agent: spec.provider,
        state: spec.state,
        stateStartedAt,
        firstSeenAt: now - 95 * MIN,
        lastSeenAt: now - (spec.quiet ?? 0) * MIN - 2000,
        history: [
          { state: 'working', at: now - 90 * MIN },
          ...(spec.state === 'working' ? [] : [{ state: spec.state, at: stateStartedAt }])
        ],
        ...spec.rest
      }
    }
    const kid = (id, name, description, state, tool, toolKind) => ({
      id, kind: 'agent', name, description, tool: tool ?? null, toolKind: toolKind ?? null, state, reported: true, lastReportedAt: now - 5000, missingSince: null
    })
    const codexWindow = 400000

    const agents = [
      // Storefront: a coordinator and three workers in their own worktrees.
      agent('s1-wren', {
        project: '/demo/atlas-web', workspace: '/demo/atlas-web', provider: 'claude', state: 'working', inState: 41,
        rest: {
          title: 'Ship the new checkout flow',
          prompt: 'Coordinate the checkout rewrite: split it into validation, cart accessibility and end-to-end tests, give each to a worker, then merge the branches in order.',
          active: [call(now, 'w-a', 'Task', 'delegate', 'Review the merged checkout branches', 0.4)],
          recent: [
            call(now, 'w-1', 'Bash', 'shell', 'git merge checkout-e2e', 2, 4),
            call(now, 'w-2', 'Read', 'read', 'docs/checkout-plan.md', 9, 1),
            call(now, 'w-3', 'Grep', 'search', 'useCheckout', 14, 2),
            call(now, 'w-4', 'TodoWrite', 'plan', 'Plan the merge order', 31, 1)
          ],
          toolCount: 63,
          helpers: [{ id: 'h1', kind: 'agent', name: 'general-purpose', description: 'Review the merged checkout branches', tool: 'Read', toolKind: 'read' }],
          // Kai is a reported child by exact id; Sage and Noel name Wren as their parent.
          family: [kid('s3-kai', 'Kai', 'Validate card and address fields', 'working', 'Edit', 'edit')],
          context: { tokens: 168000, window: null, compactions: 1, today: 2400000 },
          insight: {
            model: null,
            todos: [
              { text: 'Split the checkout rewrite into three workers', status: 'completed' },
              { text: 'Merge checkout-e2e into the release branch', status: 'completed' },
              { text: 'Merge checkout-validation and cart-a11y', status: 'in_progress' },
              { text: 'Run the full test suite on the release branch', status: 'pending' }
            ],
            files: ['docs/checkout-plan.md', 'CHANGELOG.md']
          }
        }
      }),
      agent('s3-kai', {
        project: '/demo/atlas-web', workspace: '/demo/atlas-web-checkout-validation', provider: 'codex', state: 'working', inState: 22,
        rest: {
          title: 'Validate card and address fields',
          prompt: 'Add client-side validation to the checkout form: card number, expiry, postcode by country. Show errors under each field.',
          parentPaneKey: 's1-wren', parentId: 's1-wren',
          active: [call(now, 'k-a', 'apply_patch', 'edit', 'src/checkout/validate.ts', 0.2)],
          recent: [
            call(now, 'k-1', 'shell', 'shell', 'pnpm test checkout', 1.5, 38),
            call(now, 'k-2', 'apply_patch', 'edit', 'src/checkout/PostcodeField.tsx', 3, 2),
            call(now, 'k-3', 'shell', 'search', 'rg "postcode" src', 6, 1)
          ],
          toolCount: 41,
          context: { tokens: 196000, window: codexWindow, compactions: 0, today: 1100000 }
        }
      }),
      agent('s2-sage', {
        project: '/demo/atlas-web', workspace: '/demo/atlas-web-cart-a11y', provider: 'claude', state: 'blocked', inState: 6,
        rest: {
          title: 'Make the cart drawer keyboard accessible',
          prompt: 'Fix focus trapping and Escape handling in the cart drawer, and give the quantity stepper proper labels.',
          parentPaneKey: 's1-wren', parentId: 's1-wren',
          recent: [
            call(now, 'g-1', 'Edit', 'edit', 'src/cart/CartDrawer.tsx', 7, 3),
            call(now, 'g-2', 'Read', 'read', 'src/cart/QuantityStepper.tsx', 9, 1),
            call(now, 'g-3', 'Bash', 'shell', 'pnpm axe src/cart', 12, 20)
          ],
          toolCount: 27,
          context: { tokens: 88000, window: null, compactions: 0, today: 640000 },
          insight: {
            model: null,
            todos: [
              { text: 'Trap focus inside the drawer', status: 'completed' },
              { text: 'Close on Escape and return focus', status: 'completed' },
              { text: 'Label the quantity stepper', status: 'in_progress' }
            ],
            files: ['src/cart/CartDrawer.tsx', 'src/cart/QuantityStepper.tsx']
          }
        }
      }),
      agent('s4-noel', {
        project: '/demo/atlas-web', workspace: '/demo/atlas-web-checkout-e2e', provider: 'claude', state: 'done', inState: 3,
        rest: {
          title: 'Add Playwright tests for checkout',
          prompt: 'Cover the happy path, a declined card and a coupon in Playwright, and run them in CI.',
          reply: 'All 12 checkout tests pass.',
          parentPaneKey: 's1-wren', parentId: 's1-wren',
          unread: true, finishedAt: now - 3 * MIN, outcome: 'success',
          recent: [call(now, 'r-1', 'Bash', 'shell', 'pnpm playwright test', 3.2, 74)],
          toolCount: 52,
          context: { tokens: 120000, window: null, compactions: 1, today: 1300000 }
        }
      }),

      // Orders API
      agent('a1-quinn', {
        project: '/demo/beacon-api', workspace: '/demo/beacon-api-pagination', provider: 'codex', state: 'working', inState: 27,
        rest: {
          title: 'Add cursor pagination to GET /orders',
          prompt: 'Replace offset pagination on GET /orders with an opaque cursor. Keep ?page working for one release and add tests for the edge cases.',
          active: [call(now, 'q-a', 'apply_patch', 'edit', 'src/routes/orders.ts', 0.3)],
          recent: [
            call(now, 'q-1', 'shell', 'shell', 'pnpm test orders', 1.2, 41),
            call(now, 'q-2', 'apply_patch', 'edit', 'src/db/orders.sql', 4, 2),
            call(now, 'q-3', 'shell', 'search', 'rg "offset" src/routes', 8, 1),
            call(now, 'q-4', 'shell', 'read', 'sed -n 1,80p src/routes/orders.ts', 11, 1)
          ],
          toolCount: 58,
          context: { tokens: 324000, window: codexWindow, compactions: 1, today: 1900000 }
        }
      }),
      agent('a2-remy', {
        project: '/demo/beacon-api', workspace: '/demo/beacon-api-invoice-rounding', provider: 'claude', state: 'working', inState: 51, quiet: 34,
        rest: {
          title: 'Fix flaky invoice rounding test',
          prompt: 'The invoice total test fails about one run in ten. Find why and make rounding deterministic.',
          recent: [
            call(now, 'e-1', 'Bash', 'shell', 'pnpm test invoice --repeat 50', 36, 210),
            call(now, 'e-2', 'Read', 'read', 'src/billing/round.ts', 40, 1)
          ],
          toolCount: 19,
          context: { tokens: 74000, window: null, compactions: 0, today: 410000 },
          insight: { model: null, todos: [], files: ['src/billing/round.ts'] }
        }
      }),
      agent('a3-indy', {
        project: '/demo/beacon-api', workspace: '/demo/beacon-api-uuid-keys', provider: 'gemini', state: 'done', inState: 14,
        rest: {
          title: 'Migrate orders table to UUID keys',
          prompt: 'Write and run a migration that moves orders.id from integers to UUIDs without downtime.',
          reply: 'The migration failed on 3 foreign keys in shipments, so I rolled it back.',
          outcome: 'failure', finishedAt: now - 14 * MIN,
          recent: [call(now, 'i-1', 'run_shell_command', 'shell', 'pnpm migrate up', 14.5, 22)],
          toolCount: 33
        }
      }),

      agent('a4-eden', {
        project: '/demo/beacon-api', workspace: '/demo/beacon-api-webhook-keys', provider: 'claude', state: 'blocked', inState: 9,
        rest: {
          title: 'Rotate the webhook signing keys',
          prompt: 'Rotate the webhook signing keys and re-sign the stored test fixtures. Ask before touching anything in the secrets store.',
          recent: [
            call(now, 'n-1', 'Edit', 'edit', 'src/webhooks/sign.ts', 10, 3),
            call(now, 'n-2', 'Read', 'read', 'docs/runbooks/key-rotation.md', 13, 1)
          ],
          toolCount: 21,
          context: { tokens: 54000, window: null, compactions: 0, today: 310000 },
          insight: { model: null, todos: [], files: ['src/webhooks/sign.ts'] }
        }
      }),

      // Docs site
      agent('d1-harper', {
        project: '/demo/compass-docs', workspace: '/demo/compass-docs-getting-started', provider: 'claude', state: 'working', inState: 18,
        rest: {
          title: 'Rewrite the getting-started guide',
          prompt: 'Rewrite docs/getting-started.md for someone who has never used the CLI: install, first command, first project.',
          active: [call(now, 'h-a', 'Edit', 'edit', 'docs/getting-started.md', 0.1)],
          recent: [
            call(now, 'h-1', 'Read', 'read', 'docs/cli-reference.md', 2, 1),
            call(now, 'h-2', 'WebFetch', 'web', 'nodejs.org/en/download', 5, 3),
            call(now, 'h-3', 'Read', 'read', 'docs/getting-started.md', 8, 1)
          ],
          toolCount: 24,
          context: { tokens: 61000, window: null, compactions: 0, today: 520000 },
          insight: {
            model: null,
            todos: [
              { text: 'Outline the guide in five steps', status: 'completed' },
              { text: 'Write install and first command', status: 'in_progress' },
              { text: 'Add a troubleshooting section', status: 'pending' }
            ],
            files: ['docs/getting-started.md']
          }
        }
      }),
      agent('d2-jules', {
        project: '/demo/compass-docs', workspace: '/demo/compass-docs-link-check', provider: 'opencode', state: 'done', inState: 0.05,
        rest: {
          title: 'Fix broken links in the changelog',
          prompt: 'Find and fix the broken links in CHANGELOG.md and add a link check to CI.',
          reply: 'Fixed 14 broken links.',
          outcome: 'success', finishedAt: now - 3000,
          recent: [call(now, 'j-1', 'bash', 'shell', 'pnpm lint:links', 0.2, 12)],
          toolCount: 17
        }
      }),
      agent('d3-bailey', {
        project: '/demo/compass-docs', workspace: '/demo/compass-docs-code-dark', provider: 'codex', state: 'waiting', inState: 4,
        rest: {
          title: 'Dark theme for code samples',
          prompt: 'Give the code samples a dark theme that follows the site toggle.',
          recent: [call(now, 'b-1', 'apply_patch', 'edit', 'theme/code.css', 4.5, 2)],
          toolCount: 12,
          context: { tokens: 52000, window: codexWindow, compactions: 0, today: 230000 }
        }
      }),

      // Mobile app
      agent('m1-casey', {
        project: '/demo/drift-mobile', workspace: '/demo/drift-mobile-rn-upgrade', provider: 'claude', state: 'blocked', inState: 12,
        rest: {
          title: 'Upgrade React Native to 0.80',
          prompt: 'Upgrade React Native and fix what breaks. Ask before changing any native module.',
          recent: [
            call(now, 'c-1', 'Bash', 'shell', 'pnpm install', 13, 52),
            call(now, 'c-2', 'Edit', 'edit', 'package.json', 15, 1),
            call(now, 'c-3', 'WebFetch', 'web', 'reactnative.dev/blog', 17, 3)
          ],
          toolCount: 46,
          context: { tokens: 301000, window: null, compactions: 2, today: 2600000 },
          insight: {
            model: null,
            todos: [
              { text: 'Bump React Native and Hermes', status: 'completed' },
              { text: 'Fix the Android Gradle build', status: 'completed' },
              { text: 'Replace the abandoned camera module', status: 'in_progress' }
            ],
            files: ['package.json', 'android/build.gradle']
          }
        }
      })
    ]

    if (opts.fresh)
      for (const a of agents)
        if (a.state === 'done') Object.assign(a, { finishedAt: now - 1500, stateStartedAt: now - 1500, history: [{ state: 'working', at: now - 60 * MIN }, { state: 'done', at: now - 1500 }] })
    if (opts.only) {
      const keep = new Set(opts.only.map((name) => `/demo/${name}`))
      for (let i = agents.length - 1; i >= 0; i--) if (!keep.has(agents[i].projectId)) agents.splice(i, 1)
    }

    const used = {
      '/demo/atlas-web': usage(12000, 61000, 3350000, 240000, { 'claude-opus-5-5': 1900000, 'claude-sonnet-5-5': 1200000, 'gpt-5-codex': 560000 }),
      '/demo/beacon-api': usage(8000, 44000, 2300000, 160000, { 'gpt-5-codex': 1500000, 'claude-sonnet-5-5': 780000, 'gemini-3-pro': 230000 }),
      '/demo/compass-docs': usage(3000, 21000, 1050000, 80000, { 'claude-sonnet-5-5': 760000, 'gpt-5-codex': 280000, 'kimi-k2': 110000 }),
      '/demo/drift-mobile': usage(4000, 32000, 2430000, 140000, { 'claude-opus-5-5': 2000000, 'claude-sonnet-5-5': 600000 })
    }
    const perWorkspace = {
      '/demo/atlas-web': usage(3000, 14000, 1100000, 60000, { 'claude-opus-5-5': 1000000, 'claude-sonnet-5-5': 177000 }),
      '/demo/atlas-web-checkout-validation': usage(2000, 9000, 980000, 40000, { 'gpt-5-codex': 1031000 }),
      '/demo/beacon-api-pagination': usage(2000, 11000, 1700000, 70000, { 'gpt-5-codex': 1783000 }),
      '/demo/drift-mobile-rn-upgrade': usage(3000, 24000, 2430000, 90000, { 'claude-opus-5-5': 2000000, 'claude-sonnet-5-5': 547000 })
    }
    const changes = {
      '/demo/atlas-web-checkout-validation': { files: 5, added: 212, removed: 38 },
      '/demo/atlas-web-cart-a11y': { files: 3, added: 96, removed: 21 },
      '/demo/beacon-api-pagination': { files: 6, added: 301, removed: 74 },
      '/demo/beacon-api-invoice-rounding': { files: 1, added: 12, removed: 4 },
      '/demo/compass-docs-getting-started': { files: 2, added: 148, removed: 63 },
      '/demo/drift-mobile-rn-upgrade': { files: 9, added: 188, removed: 241 }
    }
    const pr = (n, title, repo) => ({ label: `PR #${n} ${title}`, url: `https://example.com/acme/${repo}/pull/${n}` })
    const links = {
      '/demo/atlas-web-checkout-e2e': [pr(214, 'Checkout end-to-end tests', 'atlas-web')],
      '/demo/beacon-api-pagination': [pr(87, 'Cursor pagination for orders', 'beacon-api')],
      '/demo/compass-docs-link-check': [pr(52, 'Fix changelog links', 'compass-docs')]
    }

    return {
      snapshot: {
        agents,
        journal: [],
        workspaces,
        projects,
        changes,
        links,
        can: { open: true },
        today: { day: day(now), finished: 7, failed: 1, blockedMs: 18 * MIN },
        usage: { day: day(now), workspaces: perWorkspace, projects: used }
      },
      // The friendly names under the drawn people, as the panel would have stored them.
      names: Object.fromEntries(agents.map((a) => [a.id, a.id.split('-')[1].replace(/^./, (c) => c.toUpperCase())])),
      // What the worker answers for the drawer's controls: every terminal agent can be reached and typed to.
      reach: (agentId) => {
        const found = agents.find((a) => a.id === agentId)
        if (!found) throw Error('no answer')
        return { goTo: 'terminal', send: true, compact: found.agent === 'claude' ? '/compact' : null }
      }
    }
  }

  /** Shifts Date so the page believes it is `hour` o'clock (decimal) today and keeps it ticking; the room window follows local time. */
  function clock(hour) {
    const RealDate = Date
    const target = new RealDate()
    target.setHours(Math.floor(hour), Math.round((hour % 1) * 60), 0, 0)
    const offset = target.getTime() - RealDate.now()
    class FakeDate extends RealDate {
      constructor(...args) {
        if (args.length) super(...args)
        else super(RealDate.now() + offset)
      }
      static now() {
        return RealDate.now() + offset
      }
    }
    window.Date = FakeDate
  }

  return { build, clock }
})()
