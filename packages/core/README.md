# @sg-widgets/core

A headless model of Flow Production Tracking (ShotGrid) fields, filters, statuses and rows. No
framework, no dependencies. The React and Svelte widgets of sg-widgets are built on it, and an app
that draws its own components uses it on its own.

```sh
npm install @sg-widgets/core
```

What it holds:

| group | what |
|---|---|
| client | One interface over the REST API with a token, over an app's own endpoints with a matching server handler, and over a generated site for tests, which lives on the `@sg-widgets/core/mock` subpath. A cache decorates any of them, and a context carries the client, the schema and status services and the site preferences. |
| schema | Field data types, what each accepts, display names, and the schema service that reads a type once and answers from memory. |
| filter | The filter tree, the operators each data type offers, the serialisation the API takes, and the facets a filter bar counts. |
| render | One line of text for a value of any data type: durations, timecodes, floats, currencies, dates, statuses and entity names. |
| edit | The parse behind every editor: what a person may type for a data type, what comes back as the stored value, and what is refused. |

What the package claims about the API comes from a recorded corpus of what a site answers, cited in
the code where it is encoded.

Documentation, the props of every widget and live demos of both frameworks:
<https://sg-widgets.vercel.app>
