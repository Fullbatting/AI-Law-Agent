import type { ApiConnector } from "../../connectors/common/types";
import { HiraHospitalConnector } from "../../connectors/hira";
import { LawSearchConnector } from "../../connectors/law";
import type { SettingsManager } from "../settings/settingsManager";

/**
 * Tool Registry — SLM이 선택할 수 있는 "허용된 Tool" 목록.
 * LLM은 여기 등록된 이름만 선택할 수 있고, 등록되지 않은 임의의 API를
 * 직접 호출할 수 없다 (기술기획서 6장 "Tool 기반 API 호출" 참고).
 */
export class ToolRegistry {
  private readonly connectorsBySource = new Map<string, ApiConnector>();

  constructor(connectors: ApiConnector[] = defaultConnectors()) {
    for (const connector of connectors) {
      this.connectorsBySource.set(key(connector.source, connector.entity), connector);
    }
  }

  register(connector: ApiConnector): void {
    this.connectorsBySource.set(key(connector.source, connector.entity), connector);
  }

  get(source: string, entity: string): ApiConnector | undefined {
    return this.connectorsBySource.get(key(source, entity));
  }

  has(source: string, entity: string): boolean {
    return this.connectorsBySource.has(key(source, entity));
  }

  list(): ApiConnector[] {
    return [...this.connectorsBySource.values()];
  }

  /** SLM 프롬프트에 넣을 수 있는 사람이 읽을 수 있는 Tool 설명 목록 */
  describeForPrompt(): string {
    return this.list()
      .map(
        (c) =>
          `- ${c.name} (source="${c.source}", entity="${c.entity}"): ${c.description}`
      )
      .join("\n");
  }
}

function key(source: string, entity: string): string {
  return `${source}:${entity}`;
}

/**
 * settingsManager를 넘기면 사용자가 설정 화면에서 입력한 키를 우선 쓰고,
 * 없으면 .env/환경변수로 폴백한다. 넘기지 않으면(테스트 등) 지금까지처럼
 * 환경변수만 본다.
 */
export function defaultConnectors(settingsManager?: SettingsManager): ApiConnector[] {
  return [
    new HiraHospitalConnector(
      undefined,
      settingsManager ? () => settingsManager.getHiraServiceKey() : undefined
    ),
    new LawSearchConnector(undefined, settingsManager ? () => settingsManager.getLawApiOc() : undefined),
  ];
}
