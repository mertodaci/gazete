import { describe, expect, it, vi, beforeEach } from "vitest";

const sendMock = vi.fn().mockResolvedValue({ data: { id: "test" }, error: null });

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock }
  }))
}));

import { sendWelcomeEmail } from "./email";

describe("sendWelcomeEmail", () => {
  beforeEach(() => {
    sendMock.mockClear();
    process.env.FROM_EMAIL = "Gazete <onboarding@resend.dev>";
    process.env.BASE_URL = "http://localhost:3000";
  });

  it("sends to the given address with a preferences link in the body", async () => {
    await sendWelcomeEmail("reader@example.com", "abc123");

    expect(sendMock).toHaveBeenCalledTimes(1);
    const call = sendMock.mock.calls[0][0];
    expect(call.to).toBe("reader@example.com");
    expect(call.from).toBe("Gazete <onboarding@resend.dev>");
    expect(call.html).toContain("http://localhost:3000/preferences?token=abc123");
  });
});
