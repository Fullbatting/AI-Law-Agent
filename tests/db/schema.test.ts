import { describe, expect, it } from "vitest";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { openDatabase, openInMemoryDatabase } from "../../core/db/schema";

describe("AppDatabase (sql.js 어댑터)", () => {
  it("접두사 없는 객체 파라미터도 올바르게 바인딩된다", async () => {
    // sql.js는 better-sqlite3/node:sqlite와 달리 접두사 없는 객체 키를
    // 조용히 NULL로 바인딩한다 — 어댑터가 @를 붙여주는지 직접 검증한다.
    const db = await openInMemoryDatabase();
    db.prepare("INSERT INTO conversations (title) VALUES (@title)").run({ title: "테스트 대화" });
    const row = db.prepare("SELECT title FROM conversations").get();
    expect(row?.title).toBe("테스트 대화");
  });

  it("위치 기반(?) 파라미터도 바인딩된다", async () => {
    const db = await openInMemoryDatabase();
    db.prepare("INSERT INTO conversations (title) VALUES (?)").run("위치 기반");
    const row = db.prepare("SELECT title FROM conversations WHERE title = ?").get("위치 기반");
    expect(row?.title).toBe("위치 기반");
  });

  it("run()이 lastInsertRowid와 changes를 정확히 반환한다", async () => {
    const db = await openInMemoryDatabase();
    const info = db.prepare("INSERT INTO conversations (title) VALUES (?)").run("A");
    expect(info.lastInsertRowid).toBe(1);
    expect(info.changes).toBe(1);

    const info2 = db.prepare("INSERT INTO conversations (title) VALUES (?)").run("B");
    expect(info2.lastInsertRowid).toBe(2);
  });

  it("all()은 매칭되는 모든 행을, get()은 없으면 undefined를 반환한다", async () => {
    const db = await openInMemoryDatabase();
    db.prepare("INSERT INTO conversations (title) VALUES (?)").run("A");
    db.prepare("INSERT INTO conversations (title) VALUES (?)").run("B");

    const rows = db.prepare("SELECT title FROM conversations ORDER BY title").all();
    expect(rows.map((r) => r.title)).toEqual(["A", "B"]);

    const missing = db.prepare("SELECT * FROM conversations WHERE id = ?").get(999);
    expect(missing).toBeUndefined();
  });

  it("파일 경로로 열면 디스크에 저장되고 다시 열었을 때 데이터가 유지된다", async () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "appdb-test-"));
    const dbPath = path.join(dir, "test.sqlite3");

    const db1 = await openDatabase(dbPath);
    db1.prepare("INSERT INTO conversations (title) VALUES (?)").run("영속 테스트");

    expect(fs.existsSync(dbPath)).toBe(true);

    const db2 = await openDatabase(dbPath);
    const row = db2.prepare("SELECT title FROM conversations").get();
    expect(row?.title).toBe("영속 테스트");

    fs.rmSync(dir, { recursive: true, force: true });
  });

  it("exec()으로 여러 문장을 한 번에 실행할 수 있다 (스키마 생성과 동일한 방식)", async () => {
    const db = await openInMemoryDatabase();
    db.exec(`
      CREATE TABLE IF NOT EXISTS extra (id INTEGER PRIMARY KEY, note TEXT);
      CREATE INDEX IF NOT EXISTS idx_extra_note ON extra(note);
    `);
    db.prepare("INSERT INTO extra (note) VALUES (?)").run("ok");
    expect(db.prepare("SELECT note FROM extra").get()?.note).toBe("ok");
  });
});
