# DocuGraph — মাস্টার প্ল্যান

ডকুমেন্টারি (ইতিহাস, ভূগোল, সংস্কৃতি, অর্থনীতি) ভিডিওর জন্য After Effects-এর একটি শক্তিশালী গ্রাফ এক্সটেনশন।
লক্ষ্য: **ডেটা পেস্ট করুন → স্টাইল বাছুন → এক ক্লিকে সম্পূর্ণ অ্যানিমেটেড, পুরোপুরি এডিটযোগ্য AE কম্প।**

---

## ১. মূল নীতি

| নীতি | মানে |
|---|---|
| **নেটিভ লেয়ার** | কোনো রেন্ডার করা ছবি নয় — প্রতিটি বার/লাইন আসল Shape Layer, প্রতিটি লেখা আসল Text Layer। কালার, ফন্ট, টাইমিং সব হাতে বদলানো যায়। |
| **সাধারণ কিফ্রেম** | অ্যানিমেশন সাধারণ কিফ্রেম + Easing — Graph Editor-এ রিটাইম করা যায়। |
| **লাইভ প্রিভিউ = আসল রেন্ডার** | প্যানেলের প্রিভিউ আর AE-এর রেন্ডার একই ইঞ্জিন ও একই অ্যানিমেশন গণিত ব্যবহার করে। যা দেখবেন, তা-ই পাবেন। |
| **বাংলা-প্রথম** | বাংলা লেবেল, বাংলা সংখ্যা (০১২৩), লাখ/কোটি গ্রুপিং (১২,৩৪,৫৬৭), "হাজার / লাখ / কোটি" সংক্ষেপ। |
| **ডকুমেন্টারি ভাষা** | টাইটেল, সাবটাইটেল, **Source লাইন**, হাইলাইট (একটি দেশ উজ্জ্বল, বাকিরা ম্লান), কাউন্ট-আপ সংখ্যা, লাইনের মাথায় চলমান লাইভ ভ্যালু। |

---

## ২. গ্রাফ কয় টাইপের, প্রতিটিতে কয়টা স্টাইল

মোট পরিকল্পনা: **১৫ টাইপ, ৫০+ ভ্যারিয়েন্ট**। প্রতিটি ভ্যারিয়েন্ট **১০টি থিমের** যেকোনোটিতে, **৫টি সাইজে** (HD, 4K, Shorts 9:16, Square, 4:5) চলে।

### ✅ ধাপ ১ — এখন তৈরি (৬ টাইপ, ২৪ ভ্যারিয়েন্ট)

| # | টাইপ | ভ্যারিয়েন্ট (স্টাইল) | ডকুমেন্টারি ব্যবহার |
|---|---|---|---|
| 1 | **Bar / Column** | Column · Horizontal (ranking) · Grouped · Stacked · 100% Stacked · Lollipop — **৬টি** | দেশভিত্তিক তুলনা, র‍্যাংকিং |
| 2 | **Line / Area** | Line · Smooth · Stepped · Area · Stacked Area — **৫টি** | GDP, জনসংখ্যার প্রবৃদ্ধি; লাইনের মাথায় ডট + লাইভ ভ্যালু |
| 3 | **Pie / Donut** | Donut · Pie · Half donut · Progress rings · Rose (Nightingale) — **৫টি** | বাজেট, এনার্জি মিক্স, ধর্ম/ভাষার অনুপাত |
| 4 | **Big Number** | Single (কাউন্ট-আপ) · Compare (A vs B) · Stat cards — **৩টি** | "৭.৫ কোটি → ১৭.৩ কোটি" ধরনের মুহূর্ত |
| 5 | **Timeline** | Horizontal · Vertical (Shorts) · Eras/spans (সাম্রাজ্য, শাসনকাল) — **৩টি** | ইতিহাস: পলাশী → ১৯৪৭ → ১৯৫২ → ১৯৭১ |
| 6 | **Population Pyramid** | Classic · Butterfly — **২টি** | জনমিতি, নারী-পুরুষ তুলনা |

### 🔜 ধাপ ২ — পরবর্তী (৫ টাইপ, ~১৬ ভ্যারিয়েন্ট)

| # | টাইপ | ভ্যারিয়েন্ট |
|---|---|---|
| 7 | **Bar Chart Race** ✅ | Horizontal race ✅ · Column race ✅ · Line race (৩) |
| 8 | **Scatter / Bubble** | Scatter · Bubble · Gapminder (সময়ের সাথে চলমান) (৩) |
| 9 | **Pictogram / Waffle** | Waffle 10×10 · Icon array (মানুষ আইকন) · Proportional circles (৩) |
| 10 | **Comparison** | Dumbbell · Slope · Waterfall · Before/After (৪) |
| 11 | **Gauge / Meter** | Semi gauge · Thermometer · Progress bar (৩) |

এছাড়া ধাপ ২-এ: লাইন চার্টে **অ্যানোটেশন** ("১৯৭১ – মুক্তিযুদ্ধ" উল্লম্ব মার্কার), থিম এডিটর ও নিজস্ব থিম সেভ, কম্প থেকে চার্ট আবার খুলে এডিট (re-edit), CSV/Excel ফাইল ইমপোর্ট।

### 🗺️ ধাপ ৩ — ভূগোল ও প্রবাহ (৪ টাইপ, ~১০ ভ্যারিয়েন্ট)

| # | টাইপ | ভ্যারিয়েন্ট |
|---|---|---|
| 12 | **Maps** | Choropleth · Bubble map · Route/flow arrows · Country highlight-zoom (৪) — GeoJSON → Shape layer |
| 13 | **Treemap / Sunburst** | Treemap · Sunburst (২) — রপ্তানি/GDP গঠন |
| 14 | **Flow** | Sankey · Chord (২) — বাণিজ্য প্রবাহ |
| 15 | **Radar** | Radar · Multi-radar (২) |

---

## ৩. ১০টি থিম (সব টাইপে প্রযোজ্য)

| থিম | মুড / কোথায় মানায় |
|---|---|
| Documentary Dark | ডিফল্ট — গাঢ় পটভূমি, সোনালি অ্যাকসেন্ট |
| Clean Editorial | সাদা, নিউজপেপার-স্টাইল |
| Vintage Archive | **ইতিহাস** — পুরোনো কাগজ, সেরিফ ফন্ট |
| Newsroom Red | ব্রেকিং নিউজ, বড় হাতের টাইটেল |
| Neon Tech | প্রযুক্তি/ভবিষ্যৎ — গ্লো ইফেক্ট সহ |
| Blueprint | প্রকৌশল/অবকাঠামো, মনোস্পেস ফন্ট |
| Minimal Mono | সাদাকালো + একটি অ্যাকসেন্ট |
| Bold Explainer | হলুদ, YouTube explainer স্টাইল |
| Geo Earth | **ভূগোল/পরিবেশ** — সবুজ-নীল |
| Cinematic Gold | সিনেমাটিক, প্রিমিয়াম |

প্রতিটি থিমে: অ্যাকসেন্ট কালার ওভাররাইড, নিজের ফন্ট (PostScript নাম), বাংলা ফন্ট আলাদা করে।

---

## ৪. অ্যানিমেশন সিস্টেম

grow (বার বাড়া) · draw (লাইন আঁকা) · sweep (পাই ঘোরা) · wipe (এরিয়া প্রকাশ) · pop (ওভারশুট সহ) · fade-up · count-up · typewriter · follow (লাইনের মাথায় ডট) · live-label (চলমান ভ্যালু)।

নিয়ন্ত্রণ: Speed (×0.4–×2.5), Stagger, Easing (Expo out / Smooth / Easy / Snappy / Linear), Overshoot চালু/বন্ধ।

---

## ৫. আর্কিটেকচার

```
extension/
  CSXS/manifest.xml        CEP প্যানেল (AE 2019+)
  shared/                  ★ একই কোড প্যানেলে ও AE-এ চলে (ES3)
    core.js                ফরম্যাটিং, পার্সিং, স্কেল, easing
    themes.js              ১০টি থিম
    build.js               spec → scene (প্রিমিটিভ + অ্যানিমেশন)
    charts/*.js            প্রতিটি টাইপের লেআউট
    samples.js             স্যাম্পল ডেটা
  client/                  প্যানেল UI + SVG প্রিভিউ রেন্ডারার
  host/                    ExtendScript: scene → Shape/Text লেয়ার + কিফ্রেম
tests/                     ইঞ্জিন টেস্ট, ES3 লিন্ট, mock-AE রেন্ডার টেস্ট
```

একটি চার্ট = **spec** (টাইপ, ডেটা, থিম, অপশন) → `DG.build()` → **scene** (rect / line / path / circle / ring / text + অ্যানিমেশন) → দুই রেন্ডারার: SVG প্রিভিউ ও AE।
নতুন চার্ট টাইপ যোগ করা মানে শুধু `shared/charts/` এ একটি লেআউট ফাইল — দুই রেন্ডারার স্বয়ংক্রিয়ভাবে কাজ করে।

---

## ৬. অগ্রগতি

- [x] কোর ইঞ্জিন, ১০ থিম, বাংলা সংখ্যা/লাখ-কোটি
- [x] ধাপ ১-এর ৬ টাইপ / ২৪ ভ্যারিয়েন্ট
- [x] লাইভ প্রিভিউ প্যানেল (প্লে/স্ক্রাব)
- [x] AE রেন্ডারার (Shape/Text লেয়ার, কিফ্রেম, কাউন্ট-আপ এক্সপ্রেশন, কন্ট্রোলার নাল)
- [x] টেস্ট: ৪৮০টি বিল্ড (টাইপ × ভ্যারিয়েন্ট × থিম × সাইজ), ES3 লিন্ট, mock-AE
- [x] আসল After Effects-এ প্যানেল কানেক্ট হয় (AE 26.3)
- [x] "DG is undefined" বাগ ঠিক করা হয়েছে
- [x] Bar Chart Race (horizontal + column)
- [x] **লাইভ ডেটা:** AE-তে `DG Controller`-এর স্লাইডার বদলালে চার্ট নিজেই বদলায় (Bar, Pie/Donut, Big Number)
- [x] **Update open comp:** কম্প থেকে সেটিংস লোড → এডিট → একই কম্পে আপডেট
- [x] টেবিল ডেটা এডিটর (Excel থেকে পেস্টও চলে)
- [x] **Motion Bro স্টাইল ওয়ার্কফ্লো:**
  - Gallery: সব স্টাইলের অ্যানিমেটেড থাম্বনেইল (hover = play, click = use)
  - Create চাপলে চার্ট খোলা কম্পে প্লেহেডে precomp হিসেবে বসে
  - Essential Properties: Title / Subtitle / Source, সব রঙ (Color Controls), ডেটা স্লাইডার, Chart Scale / Position
  - মেইন কম্পে চার্ট লেয়ার সিলেক্ট করে Load → এডিট → Update
- [ ] লাইভ ডেটা: Line, Stacked, Timeline, Pyramid
- [ ] Essential Properties-এ ফন্ট বদল (AE 2024+ API যাচাই সাপেক্ষে)
- [ ] ধাপ ২ বাকি: Scatter/Bubble, Waffle, Comparison, Gauge, অ্যানোটেশন, re-edit
- [ ] ধাপ ৩: ম্যাপ, Treemap, Sankey, Radar
- [ ] সাইন করা ZXP প্যাকেজ
