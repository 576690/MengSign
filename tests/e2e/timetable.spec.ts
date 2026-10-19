import { expect, test } from "@playwright/test";
import { shanghaiDay } from "../../lib/course";
import { weekDays } from "../../lib/timetable";
test("demo timetable supports both views, details, dark mode and narrow screens", async ({
  page,
}, info) => {
  let requests = 0;
  page.on("request", (r) => {
    if (r.url().includes("/api/timetable")) requests++;
  });
  await page.goto("/");
  await page.getByRole("button", { name: "体验演示模式" }).click();
  await page
    .getByRole("button", { name: "课表", exact: true })
    .filter({ visible: true })
    .click();
  await expect(page.getByRole("heading", { name: "我的课表" })).toBeVisible();
  await page.getByRole("button", { name: "周视图", exact: true }).click();
  await expect(page.locator(".week-column")).toHaveCount(7);
  await page.locator(".timetable-course").first().click();
  await expect(page.getByRole("dialog")).toContainText("课程详情");
  await expect(page.getByRole("dialog")).toContainText("教师");
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await page.screenshot({
    path: `artifacts/${info.project.name}-timetable-week.png`,
    fullPage: true,
  });
  await page.getByRole("button", { name: "按日", exact: true }).click();
  await expect(page.locator(".day-picker button")).toHaveCount(7);
  await page.locator(".day-picker button").first().click();
  await expect(page.locator(".day-summary")).toContainText("周一");
  await page.getByRole("button", { name: "切换深浅主题" }).click();
  await expect(
    page.locator('.day-picker button[aria-pressed="true"]'),
  ).toHaveCSS("background-color", "rgb(32, 61, 56)");
  await page.screenshot({
    path: `artifacts/${info.project.name}-timetable-day-dark.png`,
    fullPage: true,
  });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  expect(requests).toBe(0);
});
test("authenticated timetable loads lazily, preserves cache offline and clears it on logout", async ({
  page,
  context,
}) => {
  const days = weekDays(),
    date = shanghaiDay();
  let requests = 0;
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({
      json: { profile: { accountKey: "test-account", label: "•••• 1234" } },
    }),
  );
  await page.route("**/api/courses", (r) =>
    r.fulfill({
      json: { courses: [], weeklyCourses: [], date, updatedAt: Date.now() },
    }),
  );
  await page.route("**/api/auth/logout", (r) =>
    r.fulfill({ json: { ok: true } }),
  );
  await page.route("**/api/timetable", (r) => {
    requests++;
    return r.fulfill({
      json: {
        accountKey: "test-account",
        weekStart: days[0],
        weekEnd: days[6],
        updatedAt: Date.now(),
        courses: [
          {
            id: "1234567",
            uuid: "",
            day: date,
            name: "测试周课表课程",
            teacher: "测试教师",
            beginTime: "08:00",
            endTime: "10:00",
            signed: false,
          },
        ],
      },
    });
  });
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "今天，也从容一点." }),
  ).toBeVisible();
  expect(requests).toBe(0);
  const tab = (name: string) =>
    page.getByRole("button", { name, exact: true }).filter({ visible: true });
  await tab("课表").click();
  await expect(page.getByText("测试周课表课程", { exact: true })).toBeVisible();
  expect(requests).toBe(1);
  await context.setOffline(true);
  await expect(page.getByText("离线查看本机保存的本周课表")).toBeVisible();
  await tab("今日").click();
  await tab("课表").click();
  await expect(page.getByText("测试周课表课程", { exact: true })).toBeVisible();
  expect(requests).toBe(1);
  await context.setOffline(false);
  await tab("设置").click();
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "欢迎来到 MengSign" }),
  ).toBeVisible();
  expect(
    await page.evaluate(() =>
      Object.keys(localStorage).some((k) =>
        k.startsWith("mengsign:timetable:"),
      ),
    ),
  ).toBe(false);
});
test("weekly API errors remain explicit instead of becoming an empty week", async ({
  page,
}) => {
  await page.route("**/api/auth/session", (r) =>
    r.fulfill({
      json: { profile: { accountKey: "test-error", label: "测试" } },
    }),
  );
  await page.route("**/api/courses", (r) =>
    r.fulfill({
      json: {
        courses: [],
        weeklyCourses: [],
        date: shanghaiDay(),
        updatedAt: Date.now(),
      },
    }),
  );
  await page.route("**/api/timetable", (r) =>
    r.fulfill({
      status: 502,
      json: { error: { message: "学校暂未返回可用周课表" } },
    }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "课表", exact: true })
    .filter({ visible: true })
    .click();
  await expect(
    page.getByRole("alert").filter({ hasText: "学校暂未返回可用周课表" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "暂未获取到本周课表" }),
  ).toBeVisible();
  await expect(page.getByText("这一天没有课程安排")).toHaveCount(0);
});
