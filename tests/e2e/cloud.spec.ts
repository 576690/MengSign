import { test, expect } from "@playwright/test";
test("cloud school clock is reachable and private APIs reject anonymous requests", async ({
  page,
}) => {
  test.skip(
    process.env.SCHOOL_SMOKE !== "1",
    "Opt-in read-only live school probe",
  );
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "欢迎来到 MengSign" }),
  ).toBeVisible();
  const result = await page.evaluate(async () => {
    const r = await fetch("/api/clock", { cache: "no-store" });
    return {
      status: r.status,
      cache: r.headers.get("cache-control"),
      data: await r.json(),
    };
  });
  console.log("School clock smoke:", JSON.stringify(result));
  expect(result.status).toBe(200);
  expect(typeof result.data.timestamp).toBe("number");
  expect(Math.abs(result.data.timestamp - Date.now())).toBeLessThan(60_000);
  expect(result.cache).toContain("no-store");
  const checks = await page.evaluate(async () => {
    const a = await fetch("/api/courses");
    const b = await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ account: "x".repeat(5000), password: "x" }),
    });
    return { anonymous: a.status, oversized: b.status };
  });
  expect(checks).toEqual({ anonymous: 401, oversized: 413 });
});
