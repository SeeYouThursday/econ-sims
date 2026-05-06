import { expect, test } from '@playwright/test';

const DEFAULT_CLASSROOM_CODE = 'DEMO101';
const DEFAULT_USERNAME = 'student_01';
const DEFAULT_PASSCODE = 'code-1234';

test('student sign-in form submits correct classroom alias and passcode', async ({
  page,
}) => {
  await page.route('**/api/stock-game/auth', async (route) => {
    const request = route.request();
    const postData = request.postData() ?? '{}';
    const body = JSON.parse(postData);

    expect(body).toEqual({
      classroomCode: DEFAULT_CLASSROOM_CODE,
      username: DEFAULT_USERNAME,
      studentPasscode: DEFAULT_PASSCODE,
    });

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        token: 'test-token',
        classroomCode: DEFAULT_CLASSROOM_CODE,
        username: DEFAULT_USERNAME,
        expiresAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      }),
    });
  });

  await page.goto('/stock');
  await page.getByLabel('Class code').fill(DEFAULT_CLASSROOM_CODE);
  await page.getByLabel('Student alias').fill(DEFAULT_USERNAME);
  await page.getByLabel('Student passcode').fill(DEFAULT_PASSCODE);
  await page.getByRole('button', { name: /sign in to class/i }).click();

  await expect(
    page.getByText(`${DEFAULT_USERNAME} in ${DEFAULT_CLASSROOM_CODE}`),
  ).toBeVisible();
});
