# Family Table — budget family meal planner

A lightweight, responsive, **no-backend** web app built from the printable 2–8 November 2026 family meal pack. Includes original food illustrations, seven-day meal planner, alternative recipes, recipe exclusion/rotation, cost-aware shopping list and portable lunches.

## Features

- Seven dinners for the whole family; weekday school lunches for three teenagers; Saturday and Sunday picnic lunches for everyone; daily breakfasts.
- Whole coffee beans and optional milk allowance, counted in shopping quantities.
- **Budget-first weekly generator:** enter a grocery target, number of family members and school lunches, then generate breakfast, lunch and dinner selections from the existing recipe library (all or selected meals). The generator aims for a varied, affordable menu and warns when its search cannot find a plan within the target.
- Swap an individual meal or rotate the seven dinners; automatically recalculate the grocery items and cost.
- Exclude a disliked meal from future rotations, restore it later, view ingredients and cooking method.
- Change family size, school-lunch count, weekly AUD budget, coffee quantities and individual estimated pack prices.
- Track pantry supplies, tick shopping items, copy grocery list, print current view.
- Save changes to browser localStorage; export/import a JSON backup.
- Installable PWA with an offline cache, after the first successful load.
- Generated dinners always contain a meat/fish protein; no beans or lentils in the initial recipe library; the frozen vegetable choice has no green beans.

## Run it locally

All dependencies are browser-native. Run a static web server from the repository root:

```bash
python3 -m http.server 8080
# http://localhost:8080
```

Or run via Docker:

```bash
docker compose up --build -d
# http://localhost:8080
```

Do **not** open `index.html` as a `file://` URL; JS modules and service workers are meant to run from a web server.

## Publish to GitHub Pages

1. Create your GitHub repository and push these files to `main`.
2. In repository **Settings → Pages**, choose **GitHub Actions** as the source.
3. The `Publish to GitHub Pages` action will deploy on each push to `main`.
4. Open the GitHub Pages URL shown by the action's deployment job.

All paths are relative, so the app works under a GitHub Pages repository subpath.

## Deploy with Docker Swarm + Traefik

Build and publish the container image to a registry that Swarm nodes can pull from. Update `MEAL_IMAGE` to your image. Ensure the external network matches your Traefik overlay network and a TLS-enabled `websecure` router exists. Example:

```bash
export MEAL_HOST='meals.example.com'
export TRAEFIK_NETWORK='traefik-public'
export MEAL_IMAGE='ghcr.io/your-org/family-meal-planner:latest'
docker stack deploy --with-registry-auth -c stack.yml familytable
```

The provided stack is an example, **not a one-click deployment**. Review your network, Traefik router policies and image. Add Authentik forward-auth middleware to the router if the site is private. Storage is browser-local, so a replica does not require a database, but changes **do not sync between devices**.

## Testing

```bash
npm run check
npm test
```

## Pricing and food safety

Seed values are **indicative shopping estimates** from the earlier printable pack, not real-time Woolworths prices, and no provider shopping-cart API is connected. Prices are editable per pack. Exact meat weights, local discounts, taxes and availability can affect checkout totals. The supplied base plan is approximately **$198.10**, leaving a small buffer against the $200 weekly budget. It includes standard lunchbox snacks and fruit; it does **not** include weekday adult lunches or extra after-school snacks.

Coffee reference: [Coffee. Beans Medium Roast 1kg at Woolworths](https://www.woolworths.com.au/shop/productdetails/6056658). The 1 kg bag is a **purchase pack**, while the default measured usage is 60 g/day.

Packed lunches with meat, egg, cheese, mayonnaise or tuna must be held cold using insulated bags and frozen ice packs. Cook chicken to 75°C and refrigerate promptly. Pantry spices, salt and pepper are not in the price total.

## What can come next

- Multi-user accounts, household roles, a shared PostgreSQL store and sync across devices.
- Real supermarket product data / carts, if a supported partner API becomes available.
- Add your own recipes, nutrition, leftovers, recipe photos, weekly history and meal preferences.
- Integration as a module inside your existing self-hosted household application.

MIT licence for the app code; included food illustrations were created for this meal pack.
