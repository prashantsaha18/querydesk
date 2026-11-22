# Querydesk

Querydesk translates plain-English retail analytics questions into read-only SQL, executes the SQL in your browser, and shows the rows and a chart. You can inspect the generated query, browse the schema, or export results to CSV.

[Open the hosted app](https://querydesk-prashant-saha.fizzycurlew16.chatgpt.site) (owner access required). Anyone with a copy of the repository can run the same app locally.

## Run locally

From the repository root, use Python 3 to serve the bundled app.

~~~bash
python -m http.server 8000 --directory dist
~~~

On Windows, use `py -m http.server 8000 --directory dist` if your Python launcher is `py`. Open [localhost:8000](http://localhost:8000/) in your browser. All runtime assets and the sample database are included.

## Try a question

- “Show monthly revenue for the first half of 2025.” The six monthly totals add up to **$122,936**.
- “Which are the top 5 products by revenue?”
- “How many orders came from each region?”

## How it works

The translator in `dist/engine.mjs` uses a rule-based grammar for metrics such as revenue, order count, units sold, and average order value. It maps recognized dates, filters, and groupings to SQL. The app opens a local SQLite database with sql.js and enables `PRAGMA query_only` before processing questions. Query history is stored in the current browser.

The sample contains 2,597 synthetic orders from 2025 across four tables. To regenerate it, run `python scripts/seed.py`. To host your own copy, publish the contents of `dist/` with any static web server.
