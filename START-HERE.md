# Spoke: your Figma Make mission plan

**Deadline:** Monday, November 30, 2026 at 11:59 PM PT. Aim to submit by **Saturday, November 28** so you have time to spare.

**Total time:** about 2 hours.

---

## Your app idea

| | |
|---|---|
| **Name** | Spoke |
| **Who it's for** | Adults in Chicago who are new to cycling and nervous about riding with a group |
| **The one job** | Find and join a beginner-friendly, **no-drop** group ride this week. No-drop means the group waits for everyone. |
| **Screens** | Home → Details → Join → Done |

## What's in this folder

| File | What it is |
|---|---|
| `START-HERE.md` | This plan, with every prompt ready to copy |
| `SUBMISSION.md` | Text for the submission form: title and description |
| `MARKET-RESEARCH.md` | How Spoke compares to Strava, Komoot and other ride apps, with sources |
| `cover.png` | Cover image for the form (1800 × 1200, 3:2) |
| `prototype/index.html` | A working reference version of the app. Double-click it to tap through in your browser. |
| `prototype/screens/` | Phone screenshots: the 4 main screens, plus My rides and a full ride with a waitlist |

> **Important:** The contest needs a **figma.site** link made in Figma Make. The HTML prototype here is your target and your backup. It is not the thing you submit.

---

## Step 0: Get Figma access (10 min)

- [ ] **Student?** Get Figma Pro free with your school email (Education plan).
- [ ] **Not a student?** Use the free Figma Pro trial link from the mission page.
- [ ] Log in at figma.com and click **Make** (top right).

## Step 1: Generate the 4 screens (15 min)

- [ ] Paste **Prompt A** into the Figma Make chat:

```text
Design 4 mobile app screens for an app called Spoke. It's for adults in Chicago who are new to cycling and nervous about riding with a group, and it helps them find and join a beginner-friendly, no-drop group ride this week (no-drop means the group waits for everyone).

The screens:
1. Home: a greeting ("Good morning, Sam"), the headline "Your first group ride starts here.", filter chips (All rides, This weekend, Under 8 mi, Evenings), a short note that every ride is no-drop, and cards for 3 rides this week. Each card shows the day and time, ride name, meeting spot, distance, pace, how many people are going, and how many spots are left.
2. Details: the ride someone tapped (Lakefront Sunrise Roll, Saturday 8:00 AM, meet at Buckingham Fountain, Grant Park). Show a simple route map, distance 9.4 mi, pace 10–12 mph, climbing 35 ft, ride time about 1 hour, a "How this ride works" list (no-drop, a sweep rider at the back, a halfway break), the ride leader Maya Ortiz with a short quote, who's going, what to bring, and a "Join this ride" button.
3. Action: joining the ride. Ask "What are you riding?" with 4 choices (Road bike, Hybrid or city bike, E-bike, Bike share), "Group rides you've done" (None yet, 1–3, 4 or more), switches for "Pair me with a ride buddy" and "Remind me the night before", and a "Confirm my spot" button.
4. Done: "You're in, Sam!" with a ride ticket showing the ride name, when, where to meet, the bike they picked and their reminder, plus "Back to rides" and "Add to calendar" buttons.

Style: friendly, outdoorsy and confident. Use realistic content instead of placeholder text, and place the four screens side by side in one row.
```

- [ ] Use the preview icon (top right) to switch between the **horizontal** view (all 4 screens) and the **vertical** view (one at a time).

## Step 2: Check each screen (10 min)

Compare against `prototype/screens/`. Tick each one:

- [ ] **Home** has 3 ride cards, filter chips, and spots left on each card
- [ ] **Details** has a map, 4 stats, the ride leader, and a "Join this ride" button
- [ ] **Join** has 4 bike choices, the 3-part "Group rides you've done" picker, 2 switches, and "Confirm my spot"
- [ ] **Done** has "You're in", a ticket, "Back to rides" and "Add to calendar"

If a screen is wrong, name the screen and say exactly what it should show. For example:

```text
The Details screen is missing the route map. Add a simple map at the top showing a green route line along the lakefront, with a yellow start pin.
```

> **Write it down:** keep a note of what the first draft got wrong. You'll need it for the description.

## Step 3: Make it your own (20 min)

- [ ] Paste **Prompt B** to apply one look across every screen:

```text
Restyle all four screens so they feel like one app:
- Background: very light green-grey #F3F6F1. Cards: white with 20px rounded corners and a soft shadow.
- Main color for buttons, the route line and selected options: bike-lane green #0F7A4A, with white text on it.
- Highlight color for No-drop badges and the map start pin: hi-vis amber #FFC53D, with dark text on it.
- Text: near-black green #15211B. Secondary text: #4E5C54.
- "2 spots left" warnings: burnt orange #B03A0B text on #FCE9DC.
- Headings: Bricolage Grotesque, ExtraBold. Body text: Figtree.
Keep all the content and layout. On Details and Join, keep the main button in a bar fixed to the bottom of the screen.
```

- [ ] Make **at least one change by hand**: click **Edit** (top right), click into the text, and change it. Good options:
  - Change "Sam" in the greeting and on the Done screen to your own first name.
  - Rename a ride after a route in your own city.

> **Write it down:** list what you changed. For example: "green and amber colors, new heading font, my name in the greeting".

### Optional: add the extra features (only if you have credits and time left)

Do this **after** Step 5 works. Every extra screen is one more thing that can break. Paste:

```text
Add these to the existing prototype without changing the 4 main screens' layout:
1. A bottom tab bar on Home with three tabs: Rides, Saved, My rides.
2. A heart button on each ride card that saves the ride. Saved rides appear on the Saved tab.
3. A My rides tab that lists rides I joined. Tapping one opens my ride ticket.
4. A search box above the filter chips that filters rides by name or park.
5. A dark mode button at the top of Home.
6. An "Ask" tab with a simple chat screen: a greeting, 5 suggested questions as chips ("Which ride is best for a first-timer?", "What should I bring?", "What does no-drop mean?", "Any rides on a weeknight?", "I don't own a bike. Can I still come?"), and a text box with a send button. Tapping a suggestion shows a short answer that uses the ride details from the other screens.
```

Then run the Step 5 table again, and also check that each tab opens and the heart saves a ride.

## Step 4: Turn it into a prototype (10 min)

- [ ] Paste **Prompt C**. This is the mission's own wording, so don't change it:

```text
Turn these four side-by-side screens into a connected mobile prototype that shows one screen at a time. Start on Home, and connect the buttons so I can move through the Details, Action, and Done screens. Preserve the current design and add working back navigation.
```

## Step 5: Tap through it and fix what's broken (20 min)

Tap through in this order. Tick each line that works:

| # | Tap this | It should | OK? |
|---|---|---|---|
| 1 | A ride card on Home | Open Details for **that** ride | [ ] |
| 2 | Back arrow on Details | Go back to Home | [ ] |
| 3 | "Join this ride" | Open the Join screen | [ ] |
| 4 | Back arrow on Join | Go back to Details | [ ] |
| 5 | A bike choice | Highlight only that one | [ ] |
| 6 | Each switch | Flip on and off | [ ] |
| 7 | "Confirm my spot" | Open Done, with your bike shown on the ticket | [ ] |
| 8 | "Add to calendar" | Show a short confirmation message | [ ] |
| 9 | "Back to rides" | Go to Home | [ ] |
| 10 | A filter chip | Change which rides show | [ ] |

When something fails, use this pattern: **"When I tap X, Y happens. It should Z."** Paste whichever of these match:

```text
When I tap a ride card on Home, nothing happens. It should open the Details screen for that ride.
```
```text
There is no way back from the Details screen. Add a back arrow at the top left that returns to Home. Do the same on the Join screen, returning to Details.
```
```text
When I tap "Join this ride", nothing happens. It should open the Join screen.
```
```text
When I tap a bike type, it doesn't look selected. Only one bike type should be selected at a time, shown with a green border and a check mark.
```
```text
The "Pair me with a ride buddy" and "Remind me the night before" switches don't move when I tap them. They should toggle on and off.
```
```text
When I tap "Confirm my spot", nothing happens. It should open the Done screen, and the ticket should show the bike type I picked.
```
```text
When I tap "Add to calendar", nothing happens. It should show a short message at the bottom: "Added Saturday, 8:00 AM to your calendar."
```
```text
After I tap "Back to rides", the ride I joined looks the same. That card should show a green "You're going" badge.
```
```text
The bottom button bar covers the end of the screen. Add space at the bottom so I can scroll to everything.
```

- [ ] After **each** fix, tap through the whole table again. One fix can break something else.

> **Write it down:** list what you fixed. This is the last part of your description.

**If the agent's design drifts far from the plan:** attach the four images from `prototype/screens/` in the Figma Make chat and write: *"Match the layout and content of these screenshots, keeping my colors and fonts."*

## Step 6: Publish (5 min)

- [ ] Optional: rename the app to **Spoke**.
- [ ] Click **Publish** (top right), then **Publish** again to confirm.
- [ ] Copy the link that ends in **figma.site**.
- [ ] Open it **on your phone** and in a **private/incognito window** on your laptop. Run the Step 5 table again.
- [ ] If you change anything later: **Publish → Update**, or the link keeps showing the old version.

## Step 7: Submit (10 min)

- [ ] Open `SUBMISSION.md` and fill in the form from it.
- [ ] Tick **Share to Showcase**. Only Showcase projects are entered in the $1,000 challenge, and they are public.
- [ ] Click **Publish** on the submission form.

---

## Quick troubleshooting

| Problem | What to do |
|---|---|
| Can't find **Make** | You need the Pro or Education plan (Step 0). |
| Out of AI credits | Make small changes by hand with **Edit** instead of the chat. |
| Link shows an old version | In Figma Make: **Publish → Update**. |
| Link doesn't open for others | Check it in a private window. Republish if needed. |
| A fix broke another button | Run the Step 5 table again and report the new problem using the same pattern. |
