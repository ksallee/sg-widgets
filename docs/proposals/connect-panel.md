# Connect panel

A proposal for the header control that says what the demos read. It covers the flow, where the
control lives, and what the panel is made of. Nothing here is implemented yet.

The docs site sidebar has three groups (Start, Core, Widgets) and no place for a proposal, so this
page stays a repo doc.

## Current state

The header carries a `Connect` button. It opens a 24rem panel holding, in this order: the Mock/Live
choice, a site url field, a status line, a note about the dev token, a Log in and a Log out button,
and a project picker. The panel is a plain element with `role="dialog"`, opened and dismissed by two
document listeners.

Four of those parts hide themselves by state: the project picker waits for a client, Log in shows
when nobody is signed in, Log out when somebody is, and the dev note only when the dev key minted the
token. The source choice and the site field show in every state.

Two light shots, taken on the StatusBadge page with the panel open:

    pnpm qa --start --path /widgets/status-badge/ --drive tools/drives/connect-panel-state.js --shot shots/connect-panel-mock-light.png
    pnpm qa --start --live --path /widgets/status-badge/ --drive tools/drives/connect-panel-state.js --shot shots/connect-panel-live-light.png

`shots/` is ignored by git and the live shot names the test site, so neither image is committed. The
drive opens the panel and reports which rows the state shows.

On Mock the panel is 384px wide and 220px tall: the source choice, the `Site` label over an empty url
field, the line `The demos read fixtures.`, and a `Log in` button. On Live with the dev key it is
326px tall: the source choice, the site field filled with the site url, a status line naming the same
url a second time, the dev note, and the project picker under it. The trigger says `Connect` on Mock
and `Live · <site> · Whole site` on Live.

## The problem

Mock still shows the site url field, the login controls and the dev note, none of which apply to
fixtures. Three of the four rows under the choice belong to the other source.

Live states the same fact twice: the site url sits in an editable field and again in the status
line. The login state is spread over three rows, a status line, a note and a button pair, so the
answer to "can this read the site" is assembled by the reader rather than stated.

The trigger says `Connect` on Mock, which names the control, not the state.

## The flow

One choice, then the rows that choice needs. Mock is the choice and nothing under it. Live shows the
site, the login state and the project, in that order, and each row carries only the control its state
needs.

The trigger label keeps its three parts, `lead · site · scope`, and only the site part truncates.

| State | Trigger | Under the choice |
|---|---|---|
| Mock | `Mock` | Nothing. |
| Live, no site | `Live · no site` | Site: the url input and a `Use site` button. |
| Live, site, signed out | `Live · <site> · signed out` | Site: the host and `Change`. Login: `Sign in` and the line `Sign in to read the site.` |
| Live, approval pending | `Live · <site> · approving` | Site: the host and `Change`. Login: the busy `Sign in` and the line `Approve the request in the tab that opened.` |
| Live, signed in | `Live · <site> · <project>` | Site: the host and `Change`. Login: `Signed in as <login>` and `Sign out`. Project: the picker, `Whole site` when unset. |
| Live, dev key | `Live · <site> · <project>` | Site: the host and `Change`. Login: `Reading with the dev key`. Project: the picker. |
| Live, refused | `Live · <site> · not reading` | Site: the host and `Change`. Login: the refusal and `Sign in`. |

The site row is text plus `Change`; `Change` swaps the row into the url input and a `Use site`
button. The url field is a step, not a permanent row, so the site is one line in every settled state.

The status line goes. Each row says its own state, and a failure appears on the row that failed.

The dev key state has no sign-in control, because the token is already minted, and no note about
where it came from beyond the row's own label.

The panel sizes to its content and is capped at 24rem, so Mock is a small box holding one control.

## Where the source lives

The source can sit in the header, with the rest of Connect, or on each demo's toolbar beside
framework, reduced motion and radius.

Recommendation: the header. The source is one site-wide, persisted choice, and changing it reloads
the page, because a demo is built once when its island mounts. The toolbar holds view preferences
that apply without a reload and carry no credentials; a site url and a login repeated above every
example would read as per-demo scope the choice does not have. Every demo already carries its source
as `data-source`, so a toolbar that wants to name the source can read it without owning it.

## Popover or plain element

Recommendation: a shadcn Popover, mounted as one Svelte island in the header.

The panel is a plain element today because the project picker inside it portals to `<body>`, and the
hand-written outside-click dismissal has to let that surface through. It does so with an allow-list
of `data-slot` selectors, and Escape needs a matching guard so the picker closes before the panel.
Both are re-implementations of what the primitive's layer stack already does.

What the change buys:

- Dismissal follows the layer stack. The topmost surface closes first, with no selector allow-list
  and no document listeners.
- Focus moves into the panel on open and returns to the trigger on close, which the plain element
  does only for Escape.
- The enter and exit animation is the primitive's `data-state` one, which is what the design rules
  ask popovers to use.

What it costs: one hydration boundary in the header on every page, and a panel written in one
framework. Svelte, since the project picker inside the panel already mounts Svelte there.

The trigger stays in Starlight's own vocabulary (`--sl-color-*`) so the header still reads as the
header; the panel keeps the shadcn tokens through `sg-demo-chrome`, so the picker inside it looks
like a picker.

## Wireframes

The trigger, then the panel under it.

Mock. The panel is the choice.

    [ Mock ]

    +------------------------------------------+
    | +------+------+                          |
    | | Mock | Live |                          |
    | +------+------+                          |
    +------------------------------------------+

Live, no site.

    [ Live · no site ]

    +------------------------------------------+
    | +------+------+                          |
    | | Mock | Live |                          |
    | +------+------+                          |
    |                                          |
    | Site                                     |
    | [ https://northstar.example.com        ] |
    | [ Use site ]                             |
    +------------------------------------------+

Live, signed out.

    [ Live · northstar · signed out ]

    +------------------------------------------+
    | +------+------+                          |
    | | Mock | Live |                          |
    | +------+------+                          |
    |                                          |
    | Site   northstar.example.com    [Change] |
    |                                          |
    | [ Sign in ]    Sign in to read the site. |
    +------------------------------------------+

Live, signed in.

    [ Live · northstar · Ocean Floor ]

    +------------------------------------------+
    | +------+------+                          |
    | | Mock | Live |                          |
    | +------+------+                          |
    |                                          |
    | Site   northstar.example.com    [Change] |
    |                                          |
    | Signed in as a.rossi        [ Sign out ] |
    |                                          |
    | Project                                  |
    | [ Ocean Floor                        v ] |
    +------------------------------------------+

Live, dev key. The login row states the key and offers nothing.

    +------------------------------------------+
    | +------+------+                          |
    | | Mock | Live |                          |
    | +------+------+                          |
    |                                          |
    | Site   northstar.example.com    [Change] |
    |                                          |
    | Reading with the dev key                 |
    |                                          |
    | Project                                  |
    | [ Ocean Floor                        v ] |
    +------------------------------------------+

Live, refused. The failure sits on the row that failed.

    +------------------------------------------+
    | +------+------+                          |
    | | Mock | Live |                          |
    | +------+------+                          |
    |                                          |
    | Site   northstar.example.com    [Change] |
    |                                          |
    | The site refused the read.               |
    | [ Sign in ]                              |
    +------------------------------------------+

## Rules the implementation keeps

- Tokens only inside the panel. The trigger keeps Starlight's header variables; nothing else takes a
  raw colour.
- Spacing from the scale: `p-4` on the panel, `gap-3` between its rows, `gap-2` inside a row,
  `gap-1.5` between an icon and its label. Rows own their gaps; no margins on children.
- Motion from the popover primitive: fade, a 4px slide from the anchor side, `scale-95` to
  `scale-100`, 200ms, `ease-out` in and `ease-in` out. No hand-written keyframes. Reduced motion
  collapses it to opacity.
- The panel's content carries `strategy="fixed"`, is controlled with a function binding on `open`,
  and focuses in `onOpenAutoFocus` with `preventScroll`, the rule every Svelte surface holding a
  Command list follows.
- Focus rings unchanged, `focus-visible:ring-2 ring-ring ring-offset-2`. Any `.focus()` call passes
  `{ preventScroll: true }`.
- Keyboard: the trigger toggles on Enter and Space; Tab moves through the rows the state shows;
  Escape closes the topmost surface, so the project picker closes before the panel; focus returns to
  the trigger on close.
- The site host is the one thing allowed to truncate, in the trigger and in the site row, with a
  `title` carrying the full url.
- The panel is one control per row and one meaning per row. A row that has nothing to say is not
  rendered.
