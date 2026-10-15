import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const PRIMARY = "https://ord.uib.no/api/articles";
const FALLBACK = "https://odd.uib.no/opal/prod/api/articles";

const found = () => Response.json({ articles: { bm: [1], nn: [] } });
const badGateway = () => new Response("<html>502 Bad Gateway</html>", { status: 502 });

// dictionary.js keeps circuit/endpoint state at module level, so load a fresh
// copy for every test.
async function loadDictionary() {
  vi.resetModules();
  return import("./dictionary.js");
}

describe("checkWord", () => {
  let fetchMock;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("uses the primary endpoint when it answers", async () => {
    fetchMock.mockResolvedValueOnce(found());
    const { checkWord } = await loadDictionary();

    expect(await checkWord("hus")).toEqual({ status: "ok", valid: true });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toMatch(PRIMARY);
  });

  it("falls back to the backup endpoint when the primary returns 502", async () => {
    fetchMock.mockResolvedValueOnce(badGateway()).mockResolvedValueOnce(found());
    const { checkWord } = await loadDictionary();

    expect(await checkWord("hus")).toEqual({ status: "ok", valid: true });
    expect(fetchMock.mock.calls[1][0]).toMatch(FALLBACK);
  });

  it("keeps using the backup once it has answered", async () => {
    fetchMock
      .mockResolvedValueOnce(badGateway())
      .mockResolvedValueOnce(found())
      .mockResolvedValueOnce(found());
    const { checkWord } = await loadDictionary();

    await checkWord("hus");
    expect(await checkWord("bil")).toEqual({ status: "ok", valid: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[2][0]).toMatch(FALLBACK);
  });

  it("opens the circuit when both endpoints fail", async () => {
    fetchMock.mockResolvedValueOnce(badGateway()).mockRejectedValueOnce(new TypeError("fetch failed"));
    const { checkWord } = await loadDictionary();

    expect(await checkWord("hus")).toMatchObject({ status: "down", circuitOpen: false });
    expect(await checkWord("bil")).toMatchObject({ status: "down", circuitOpen: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
