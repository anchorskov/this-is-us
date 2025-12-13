<!-- File: data/mvt/merged_design.md -->
Civic Watch & Town Hall

Merged UX Design for Bills, Representatives, and Ideas

Last updated: 2025-12-06

1. Purpose

Civic Watch exists to help regular residents:

See what is happening in government in plain language.

Understand who holds responsibility for each decision.

Share ideas, concerns, and local knowledge in trusted spaces.

Connect with like-minded neighbors in transparent networks, not echo chambers.

This design merges:

The Civic Watch tools: Hot Topics and Pending Bills.

The County Town Hall system: county subdomains with verified voter participation.

New Representative and Sponsor links: contact information and public records.

A growing Ideas Network: threads and projects that can precede or follow formal legislation.

The goal is one coherent experience, not separate tools.

2. High-level Overview
2.1 Core Surfaces

Civic Watch Home
Entry point for all civic tools.

Hot Topics
Curated issues that matter across Wyoming.

Pending Bills
Live feed of current legislation with AI summaries and trust indicators.

County Town Halls
One space per county for verified voters to discuss, vote, and propose ideas.

Ideas Network
A cross-county map of ideas, projects, and authors that may or may not connect to bills yet.

2.2 Data Layers

Legislation and votes on bills: D1 wy_db and related tables.

Threads, comments, and idea networks: Firestore.

Voter file and county match: D1 voter tables.

Auth and access: Firebase Authentication plus Cloudflare Access policies for county-only participation.

3. User Roles

Visitor

No login required.

Can view Hot Topics, Pending Bills, public Town Hall threads, and public Idea Network views.

Signed-in User (unverified)

Signed in through Firebase.

Can save filters, follow topics, and bookmark ideas.

Cannot post in county Town Halls or vote in county spaces until verified.

Verified Voter

Signed in and successfully matched against the voter file for a specific county.

Can post and vote in that county's Town Hall.

Can vote on Pending Bills where local voting logic allows it.

Shows a visible indicator such as “Verified voter in Natrona County”.

Moderator

Can approve, hide, or archive threads and comments based on Perspective scores and guidelines.

Can flag or endorse idea clusters that show real momentum.

Admin

Manages configuration, data imports, schema migrations, and Representative data sources.

Sets global rules and access controls.

4. Civic Watch Home
4.1 Purpose

Provide a single mental map for civic action:

“What is happening, who is responsible, and how do we respond together.”

4.2 Layout

Key components:

Page title: “Civic Watch”

Intro copy: One short paragraph about shared responsibility and transparent tools.

Three primary cards:

Hot Topics

Description: “Six core issues that keep showing up in Wyoming conversations.”

Actions: “View topics,” “See related bills.”

Pending Bills

Description: “Bills in Cheyenne that could affect daily life.”

Actions: “View bills,” “Filter by topic.”

County Town Halls

Description: “County-level conversations, public to read, verified residents to participate.”

Actions: “Choose your county.”

Secondary panel: “Your delegation”

Once a visitor shares a location (city, zip, or full address), show:

State House district and representative.

State Senate district and senator.

Federal delegation (US House member, US Senators).

Each entry includes:

Name and title.

Contact actions (email, phone, website).

“View votes on recent bills” and “View county conversations” where available.

5. Hot Topics
5.1 Purpose

Offer a curated set of issues that matter across the state, then connect each issue to:

Pending Bills.

Existing Town Hall threads.

Ideas and authors who care about that topic.

5.2 UX

Topic chips at the top of the page:

Each chip has:

Badge icon.

Topic name.

Count of related bills and threads.

Tapping a chip filters the list below.

Topic cards in a grid or list:

Each topic card includes:

Title and short description in everyday language.

Current status indicators such as:

“12 active bills”

“7 active county threads”

“3 emerging idea clusters”

Call to action buttons:

“View related bills”

“View county conversations”

“Explore ideas and authors”

5.3 Data Connections

Each topic links to:

A set of bill_ids in D1.

A set of thread_ids in Firestore.

A set of idea_cluster_ids in Firestore.

This creates one shared backbone for Hot Topics, Pending Bills, and Ideas.

6. Pending Bills
6.1 Purpose

Help a regular resident read and respond to legislation without legal training.

6.2 Filters

Session and status

Current default: active bills in the current session.

Future: filter by committee, stage, or chamber.

Topic chips

The same topic chips used on Hot Topics.

Multiple chips can be active at once.

Search

Search by bill number, keyword, or sponsor name.

6.3 Bill Cards

Each bill card includes:

Header

Bill number (HB 22, SF 101, etc).

Short title.

Status tag such as “In committee,” “On floor,” or “Signed.”

AI Summary Panel

One paragraph summary in everyday language.

A “Details” toggle for a slightly longer breakdown.

Badge: “Generated with AI, last updated: [date].”

Confidence indicators:

A brief note such as “High confidence based on full text review” or “Partial summary, see full bill text.”

Impact and Topic Tags

Tags such as “Property tax relief,” “Education funding,” “Local control.”

Counts:

“Related bills: 4”

“Related county threads: 2”

“Idea clusters: 1”

Representative and Sponsor Panel

Primary sponsor list:

Names of sponsors with:

“More info” link to a sponsor profile page.

“Contact sponsor” button.

Opens a panel with phone, email, and website fields pulled from Representative data.

Your delegation box for signed-in visitors who share location:

State House representative and State Senator cards with:

Name and district.

“Contact” button.

“View position” (once voting records or statements exist).

Federal delegation summary:

“Contact US House member”

“Contact US Senator 1”

“Contact US Senator 2”

Data source for this panel can combine:

State legislative roster files.

OpenStates or similar civic data API for sponsor and contact fields.

Manually curated overrides where needed.

Engagement Panel

Simple vote:

“Support” and “Oppose” buttons with immediate feedback.

Visible counts and simple percentages.

Clear statement: “This is a community temperature gauge, not an official ballot.”

Discussion links:

“View public discussion in your county”

“Start a new county thread about this bill” (visible to verified voters).

Save and follow:

“Add to watch list” for signed-in visitors.

Optional notifications in later phases.

Links and Source

“View full bill text” on the official legislative site.

“View bill history and roll call.”

6.4 Trust and Transparency

Every AI element is labeled as such, with date and scope.

Every summary includes a visible path back to the official text.

Every Representative name links to a page that shows:

Bio summary.

Contact info.

Votes and public statements for selected bills as data becomes available.

7. County Town Halls
7.1 Purpose

Provide one Town Hall per county where:

Anyone can read conversations.

Only verified residents of that county can post or vote.

Moderation promotes honest, firm, and respectful speech.

7.2 Access Model

Public web: read-only view of approved threads and comments.

Verified access:

Firebase sign-in.

Guided voter match to county voter file:

Step 1: name.

Step 2: address.

Step 3: consent to match.

Once matched:

County badge: “Verified voter in [County].”

Permission to create threads, comment, and vote in that county.

7.3 County Portal Layout

Each county subdomain, for example natrona-wy.this-is-us.org, includes:

Header: County name, population, and brief description.

Tabs or sections:

“Bills and decisions”

“Ideas and projects”

“Neighbors and circles”

Bills and Decisions

List of threads linked to specific bills.

Each thread card shows:

Bill number and title.

Short excerpt of the starter post.

Counts: replies and upvotes.

Clear “Related bill” tag that links back to the bill card on Civic Watch.

Ideas and Projects

Threads that are pure ideas, not tied to a bill yet:

Local library improvements.

Meeting process reforms.

New community projects.

Each idea thread can later be tagged with:

Related topic.

Potential bill references if legislation emerges.

Neighbors and Circles

Profiles for authors who opt in to public visibility:

First name or chosen display name.

County, not exact address.

Topics of interest.

Links to authored threads and ideas.

This section becomes the start of a transparent local network of civic authors and connectors.

7.4 Moderation

Draft comments run through Perspective or similar service.

High risk scores go into a moderation queue.

Authors see clear messages when content is delayed.

Public views show only approved content.

Moderation guides are published, not hidden.

8. Ideas Network & Author Connections
8.1 Purpose

Allow ideas to grow even before a bill exists, and connect like-minded people across the state in a transparent and trustworthy way.

8.2 Idea Threads and Clusters

Every idea thread, whether tied to a bill or not, has:

Topic tags.

County association.

Author.

An Idea Cluster is a group of related threads:

Same topic, similar goals, or similar language.

Can span multiple counties.

Each Idea Cluster has:

Title such as “Property Tax Relief for Seniors.”

Short description summarizing the shared concern.

Participating counties.

List of public authors who consented to be visible.

Link to relevant bills if any exist.

8.3 Author Profiles and Circles

Public author profile (opt in):

Display name.

County and city.

Topics of interest.

List of authored threads and ideas.

“Contact” option card that uses privacy-safe messaging (no direct email reveal by default).

Circles:

A circle is a small group of authors who share:

Topic tags.

County or region.

A project or recurring concern.

Each circle can track:

Shared tasks.

Meetings.

Links to existing community organizations or nonprofits.

The Ideas Network becomes the bridge between civic imagination and formal legislation.

9. Representative Data & “My Reps”
9.1 Purpose

Give each visitor easy access to:

Who represents this location.

How to contact each office.

How each representative interacts with key bills and topics.

9.2 Location Input

Options for visitors:

Enter address.

Enter city and zip.

Use an existing voter match (for verified voters).

The system maps the input to:

State House district.

State Senate district.

County.

Federal House district.

9.3 Representative Profiles

Each Representative profile includes:

Name and role (State House, State Senate, US House, US Senate).

District and county coverage.

Contact information:

Official email.

Phone numbers (Capitol and district).

Website and social media links where appropriate.

Public positions:

Votes on selected tracked bills.

Public statements or press releases, as data becomes available.

These profiles power:

The “Your delegation” panel on Civic Watch Home.

The Representative and Sponsor panel on each bill card.

Direct links from Town Hall threads when an author mentions a Representative by name.

9.4 Bill Sponsor Links

For each bill:

List sponsors and cosponsors with:

Names as clickable links to their Representative profile.

Quick contact buttons:

“Call office”

“Email office”

“Visit website”

Future option:

“Share this idea cluster with sponsor”

This would send a short digest of an Idea Cluster related to that bill, not individual personal data, unless authors explicitly opt in.

10. Data and Auth Responsibilities
Concern	Source / Store	Notes
Bills, status, sponsors	D1 wy_db + external	Snapshots from OpenStates or similar civic API.
AI summaries and matches	D1 tables for analysis	Generated through OpenAI calls with clear timestamps.
Community votes on bills	D1	Anonymous or pseudonymous by default.
Voter file and county match	D1 voter tables	Used only for verification, not public display.
Threads, comments, ideas	Firestore	County partition and topic tags.
Idea clusters and circles	Firestore	Derived from threads and tags.
Representative roster and data	D1 or separate store	Periodically refreshed from official sources.
Auth and identity	Firebase Auth	Email, optional phone, basic profile fields.
Access enforcement	Cloudflare Access	External evaluation to enforce county-only posting.
11. Phased Implementation
Phase 1: Solidify Civic Watch and basic Town Halls

Implement Civic Watch home with navigation to:

Hot Topics.

Pending Bills.

County chooser for Town Halls.

Complete Pending Bills UX:

Bill cards with AI summaries, topic chips, and vote feedback.

“Generated with AI” badges and official text links.

Basic sponsor and Representative links.

Implement public County Town Hall view:

Read-only threads per county.

Basic thread cards.

Phase 2: Verification, ideas, and “My Reps”

Add guided voter verification and county badges.

Enable posting and voting in Town Halls for verified voters.

Add Ideas and Projects tab per county.

Implement basic Idea Clusters and public author profiles.

Build “Your delegation” panel for Civic Watch Home and Bill cards.

Phase 3: Full Idea Network and circles

Expand Idea Cluster detection and visualization.

Implement author Circles and project tracking.

Add “Share idea cluster with sponsor” flows.

Enrich Representative profiles with voting history and statements.

12. UX Principles

Plain language first
Every label, summary, and help text aims at a visitor without policy training.

Trust before speed
Show sources, timestamps, and clear ownership for every piece of data.

County first, state aware
Experiences begin at the county level, but always connect to state and federal context.

Ideas can arrive before laws
Idea threads are as important as bill-linked threads, not an afterthought.

Transparent networks, not hidden influence
Public profiles and circles exist with consent, not as scraped or shadow data.