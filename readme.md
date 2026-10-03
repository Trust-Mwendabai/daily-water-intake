# Daily Water Intake Tracker (AquaTrack)

## Abstract
The Daily Water Intake Tracker is an interactive web application that helps users monitor their daily water consumption and build consistent hydration habits. Users set a daily target, log each serving, and watch an animated carafe fill as they drink. Progress is shown through live statistics, a monthly calendar heatmap, charts, streaks and achievements. The project is built entirely with HTML, CSS and JavaScript, with no backend or database; all data is kept in the browser with Local Storage.

## Pages
- **Home (index.html)**: overview of today's progress, how the app works, and hydration tips.
- **Tracker (tracker.html)**: animated carafe, quick-add servings (cup, glass, mug, bottle), custom amounts, today's log with undo and remove.
- **Calendar (calendar.html)**: monthly heatmap of intake against the target, month summary, and details for any day.
- **Dashboard (dashboard.html)**: streaks, 7/14/30-day bar chart, time-of-day doughnut chart, last-7-days progress bars, and achievements.
- **Settings (settings.html)**: daily target, target calculator, units (ml or fl oz), light/dark theme, drink reminders, and data export/import/delete.

## Project structure
```
index.html, tracker.html, calendar.html, dashboard.html, settings.html
css/styles.css      shared styles, light and dark themes
js/data.js          serving sizes, times of day, achievement definitions
js/common.js        storage, statistics, navbar, theme, toasts, reminders, carafe and canvas charts
js/home.js, js/tracker.js, js/calendar.js, js/dashboard.js, js/settings.js   page scripts
```

## Running it
Open `index.html` in any modern browser. No installation or server is needed.
