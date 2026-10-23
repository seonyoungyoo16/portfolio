export async function openExperiments(page) {
  const button = page.getByRole("button", {
    name: "직접 실험하기",
    exact: true,
  });
  if (!(await button.count())) return;
  if (!(await button.isVisible())) {
    for (const name of ["체험", "서비스", "결제·취소"]) {
      const service = page.getByRole("tab", { name, exact: true });
      if (await service.isVisible()) {
        await service.click();
        break;
      }
    }
  }
  if ((await button.getAttribute("aria-pressed")) !== "true")
    await button.click();
}
