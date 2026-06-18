# 🚀 Opportunity Radar

> **A Student Should Never Miss an Opportunity**

Opportunity Radar is a centralized opportunity aggregation platform that helps students discover internships, jobs, hackathons, workshops, scholarships, competitions, open-source programs, and career opportunities from multiple sources through a single unified platform.

---

# 📌 Problem Statement

Students often miss valuable opportunities because information is scattered across multiple platforms.

A typical student may need to browse:

* Internshala
* Unstop
* Amazon Jobs
* Devfolio
* Outreachy
* GSoC
* Y Combinator
* Greenhouse
* Hack2Skill
* LFX

every day to stay updated.

This process is:

* Time-consuming
* Repetitive
* Inefficient
* Prone to missed deadlines

Opportunity Radar solves this problem by aggregating opportunities from multiple trusted sources into one searchable platform.

---

# 🎯 Vision

Create a single platform where students can discover, track, and manage opportunities without visiting dozens of websites.

---

# ✨ Key Features

## 🔍 Smart Opportunity Search

Search across thousands of opportunities instantly.

Supports:

* Job titles
* Skills
* Companies
* Categories
* Keywords
* Locations

---

## 🏢 Company Pages

View opportunities grouped by company.

Examples:

* Amazon
* Microsoft
* Google
* Meta
* Startups
* Research Organizations

---

## 📌 Bookmark System

Save opportunities for later review.

Students can:

* Bookmark opportunities
* Manage saved items
* Track interesting opportunities

---

## 📊 Application Tracker

Track application progress.

Possible statuses:

* Interested
* Applied
* Interview
* Offer
* Rejected

---

## ⏰ Deadline Tracking

Tracks:

* Published Opportunities
* Closing Soon Opportunities
* Expired Opportunities

---

## 🔐 Authentication

Secure authentication using Supabase Auth.

Supports:

* Email Authentication
* Google Authentication

---

## 🧠 Advanced Filtering

Filter opportunities by:

* Source
* Category
* Skills
* Location
* Remote
* Company

---

# 🌐 Integrated Sources

Currently integrated:

| Source       | Type                  |
| ------------ | --------------------- |
| Amazon       | Jobs                  |
| Internshala  | Internships           |
| Unstop       | Competitions & Jobs   |
| Devfolio     | Hackathons            |
| Outreachy    | Open Source Programs  |
| GSoC         | Open Source Programs  |
| Greenhouse   | Jobs                  |
| LFX          | Open Source Programs  |
| Hack2Skill   | Hackathons            |
| Y Combinator | Startup Opportunities |

---

# 🏗️ System Architecture

## Frontend

Built using:

* Next.js
* TypeScript
* Tailwind CSS

Responsibilities:

* UI Rendering
* Search Interface
* Dashboard
* Tracker
* Authentication UI

---

## Backend

Built using:

* Supabase
* PostgreSQL
* Serverless APIs

Responsibilities:

* Data Storage
* Authentication
* Search
* Opportunity Management

---

## Database

PostgreSQL via Supabase.

Core entities:

* Opportunities
* Companies
* Users
* Bookmarks
* Application Tracker
* Notifications

---

## Hosting

| Component      | Platform      |
| -------------- | ------------- |
| Frontend       | Vercel        |
| Backend        | Supabase      |
| Database       | PostgreSQL    |
| Authentication | Supabase Auth |

---

# ⚙️ Opportunity Ingestion Pipeline

The ingestion architecture automatically imports opportunities from external providers.

## Flow

Provider

↓

Data Extraction

↓

Normalization

↓

Validation

↓

Skill Extraction

↓

Deduplication

↓

Bulk Upsert

↓

Database

↓

Frontend Search

---

# 🔄 Bulk Upsert Architecture

Initially, opportunities were inserted sequentially.

This caused:

* Slow ingestion
* Network bottlenecks
* Vercel timeout risks

The architecture was redesigned using:

* Batch Processing
* Bulk Upserts
* Database Constraints

Result:

| Records | Old Time  | New Time |
| ------- | --------- | -------- |
| 100     | ~2.3 min  | ~1.8 sec |
| 500     | ~11.6 min | ~4.4 sec |
| 1000    | ~23.3 min | ~8.6 sec |

Performance improvement:

**160x+ faster**

---

# 📈 Current Production Metrics

## Opportunities

* Total Opportunities: **4,757**
* Duplicate Records: **0**
* Missing Apply URLs: **0**
* Missing Posted Dates: **0**
* Missing Ingest Dates: **0**

## Sources

* Active Sources: **10**

## Data Quality

* Source Validation Enabled
* Deduplication Enabled
* Expiration Cleanup Enabled

---

# 🔍 Search Architecture

Search supports:

* Keywords
* Company Names
* Skills
* Categories
* Locations

Features:

* PostgreSQL Full Text Search
* RPC Search Optimization
* Fallback Search Logic
* Pagination

---

# 🛡️ Security

Security measures include:

## Authentication

* Supabase Auth

## API Protection

* Protected Cron Routes
* Secret Validation

## Database

* Row Level Security (RLS)
* Input Validation
* Deduplication Constraints

---

# 📊 Database Quality Audit

Comprehensive audit performed before deployment.

Results:

✅ 4,757 opportunities stored

✅ 0 duplicate records

✅ 0 missing apply URLs

✅ 0 missing posting dates

✅ Backup snapshot created

✅ Freshness tracking implemented

---

# 🚧 Technical Challenges Solved

## Challenge 1

Duplicate Opportunities

### Solution

Unique source constraints and deduplication engine.

---

## Challenge 2

Slow Ingestion

### Solution

Bulk Upsert Architecture.

---

## Challenge 3

Freshness Tracking

### Solution

Introduced:

* posted_at
* ingested_at

to separate actual posting dates from ingestion dates.

---

## Challenge 4

Search Scalability

### Solution

Optimized search architecture using PostgreSQL search capabilities and RPC-based querying.

---

# 📚 Project Learnings

This project provided experience in:

* Full Stack Development
* Database Design
* API Integration
* Authentication Systems
* Search Systems
* Data Engineering
* Performance Optimization
* Production Deployment

---

# 🚀 Future Scope

Planned enhancements:

## AI Recommendations

Recommend opportunities based on:

* Skills
* Interests
* Past activity

## Resume Matching

Match opportunities against uploaded resumes.

## Smart Notifications

Notify users about:

* New opportunities
* Closing deadlines
* Matching roles

## Mobile Application

Dedicated Android and iOS applications.

## Analytics Dashboard

Advanced reporting and insights.

---

# 👨‍💻 Author

**Laxman Sirvi**

First Year Engineering Student

Opportunity Radar was built to help students discover opportunities faster and eliminate the problem of scattered information across multiple platforms.

---

# 📜 License

This project is intended for educational and portfolio purposes.

---

## ⭐ If you like this project

Consider starring the repository and sharing feedback.
