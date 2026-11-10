# The J1 demo script

A one-page script for recording the J1 video and running the Sprint Review. It follows [journey J1](./product-overview.md#j1--the-happy-path-the-demo) and assumes `pnpm seed:dev:apply` has run (see the [README](../README.md#quick-start)), so there is a menu, a month of sales and orders on the board.

## Before you start

- Two browser windows side by side: **A** for the customer, **B** for staff. Window B: sign in as `staff@brewlite.test` and open `/staff`; click **Enable sound** once.
- Window A must be a **guest** (a private window). Use a **new** Google account in the emulator — `WELCOME10` is once per customer, and the demo customers have used theirs.
- Payment must be the fake provider (the default), so the card form is replaced by **Simulate success**.

## The script

| # | Do | Say |
| :---- | :---- | :---- |
| 1 | **A** — open `http://localhost:23000`. Switch **EN ↔ VI** in the header and back to English. | "No account needed to look around, and the menu speaks English and Vietnamese." |
| 2 | Open a drink, pick a size and a topping, watch the price change, **Add to cart**. Add a second drink. Open the cart. | "Options are priced as you choose; the cart is in the browser and survives a reload." |
| 3 | **Checkout** → you are sent to sign in. **Continue with Google** → *Add new account* in the emulator → back to checkout, same cart. | "Sign-in happens only now, at checkout — and the cart is still here." |
| 4 | Type `WELCOME10` → **Apply**. | "The server prices the order — the discount is its number, not the browser's." |
| 5 | **Place order**. The order page opens with its ticket number. | "The order is placed with the stock reserved; it has 35 minutes to be paid." |
| 6 | Click **Simulate success**. | "In production this is Stripe's card form; the fake provider produces the same events." |
| 7 | The page turns to *Paid*. **B** — the new order slides into **Paid** with a chime and a *New* chip. | "Staff see it without reloading." |
| 8 | **B** — **Start**. **A** shows *Brewing*. Then **Ready**: **A** turns green and the tab title changes. | "The customer's page follows live — the alert and the tab title tell them to collect." |
| 9 | **B** — **Collected**. **A** shows *Collected* and the points earned. | "Done — and the customer has loyalty points for it." |
| 10 | Window **B**: sign out, sign in as `admin@brewlite.test`, open **Overview**. | "A month of sales, today included — paid orders only, refunds excluded." |
| 11 | **Orders** → search the order number → open it. Point at the timeline (who did what), the payment and the points. | "Every order's story: who moved it and when, how it was paid." |

**If something goes wrong:** the *Live* indicator on the staff board turning to *Reconnecting…* heals by itself in seconds. A payment that did not start means `PAYMENT_PROVIDER` is not `fake` in `services/payment/.env` — restart payment after changing it.
