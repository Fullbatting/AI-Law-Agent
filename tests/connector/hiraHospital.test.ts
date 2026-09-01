import { describe, expect, it, vi, afterEach } from "vitest";
import { HiraHospitalConnector } from "../../connectors/hira/hospital";
import type { QueryDSL } from "../../core/query/dsl/types";

const SAMPLE_RESPONSE = {
  response: {
    header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
    body: {
      items: {
        item: [
          {
            yadmNm: "가나종합병원",
            clCdNm: "종합병원",
            sidoCdNm: "서울",
            sgguCdNm: "강남구",
            addr: "서울 강남구 ...",
            telno: "02-1234-5678",
            drTotCnt: "42",
            estbDd: "19900101",
            emyDayYn: "Y",
            ykiho: "A1234567",
          },
        ],
      },
      totalCount: 1,
    },
  },
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("HiraHospitalConnector", () => {
  const dsl: QueryDSL = {
    source: "hira",
    operation: "search",
    entity: "hospital",
    filters: [
      { field: "region", operator: "eq", value: "서울" },
      { field: "hospital_type", operator: "eq", value: "종합병원" },
    ],
    limit: 10,
  };

  it("buildParams가 지역/종별 코드를 올바르게 매핑한다", () => {
    const connector = new HiraHospitalConnector();
    const params = connector.buildParams(dsl);
    expect(params.filters?.sidoCd).toBe("110000");
    expect(params.filters?.clCd).toBe("11");
    expect(params.numOfRows).toBe(10);
  });

  it("serviceKey가 없으면 request가 에러를 던진다", async () => {
    const connector = new HiraHospitalConnector(undefined, () => "");
    await expect(connector.request({ filters: {} })).rejects.toThrow(/HIRA_SERVICE_KEY/);
  });

  it("정상 응답을 표준 레코드로 정규화한다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => JSON.stringify(SAMPLE_RESPONSE),
      })
    );
    const connector = new HiraHospitalConnector(undefined, () => "TEST_KEY");
    const raw = await connector.request(connector.buildParams(dsl));
    const normalized = connector.normalize(raw);

    expect(normalized.rows).toHaveLength(1);
    expect(normalized.rows[0]).toMatchObject({
      name: "가나종합병원",
      hospital_type: "종합병원",
      region: "서울",
      district: "강남구",
      doctor_count: 42,
      emergency_room: true,
    });
    expect(normalized.sourceLabel).toBe("건강보험심사평가원(HIRA)");
  });

  it("형식이 맞지 않는 항목은 건너뛰고 나머지는 정상 정규화한다", () => {
    const connector = new HiraHospitalConnector();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const raw = {
      response: {
        body: {
          items: {
            item: [
              { yadmNm: "가나병원" },
              { yadmNm: 12345 }, // yadmNm은 문자열이어야 하므로 검증 실패
            ],
          },
          totalCount: 2,
        },
      },
    };

    const normalized = connector.normalize(raw);
    expect(normalized.rows).toHaveLength(1);
    expect(normalized.rows[0].name).toBe("가나병원");
    expect(warnSpy).toHaveBeenCalledTimes(1);
    warnSpy.mockRestore();
  });

  it("응답이 오류 코드를 포함하면 예외를 던진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>SERVICE KEY IS NOT REGISTERED</errMsg></cmmMsgHeader></OpenAPI_ServiceResponse>`,
      })
    );
    const connector = new HiraHospitalConnector(undefined, () => "BAD_KEY");
    await expect(connector.request(connector.buildParams(dsl))).rejects.toThrow(/HIRA API 오류/);
  });

  it("HTTP 403이면 인증키 인코딩 문제를 안내하는 메시지를 던진다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () => "",
      })
    );
    const connector = new HiraHospitalConnector(undefined, () => "TEST_KEY");
    await expect(connector.request(connector.buildParams(dsl))).rejects.toThrow(/Decoding/);
  });

  it("HTTP 403이면서 서버가 본문에 사유를 담아 보내면 그 내용을 그대로 보여준다", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: "Forbidden",
        text: async () =>
          `<OpenAPI_ServiceResponse><cmmMsgHeader><errMsg>APPLICATION_ERROR</errMsg><returnAuthMsg>UNREGISTERED_ACTIVE_APPLICATION_KEY</returnAuthMsg></cmmMsgHeader></OpenAPI_ServiceResponse>`,
      })
    );
    const connector = new HiraHospitalConnector(undefined, () => "TEST_KEY");
    await expect(connector.request(connector.buildParams(dsl))).rejects.toThrow(
      /UNREGISTERED_ACTIVE_APPLICATION_KEY/
    );
  });

  it("이미 URL 인코딩된 서비스키를 붙여넣어도 이중 인코딩되지 않는다", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => JSON.stringify(SAMPLE_RESPONSE),
    });
    vi.stubGlobal("fetch", fetchMock);
    const connector = new HiraHospitalConnector(undefined, () => "abcDEF123%2Bxyz%3D%3D");
    await connector.request(connector.buildParams(dsl));

    const calledUrl = new URL(fetchMock.mock.calls[0][0] as string);
    expect(calledUrl.searchParams.get("serviceKey")).toBe("abcDEF123+xyz==");
  });
});
