import { Action, ActionPanel, Clipboard, List, useNavigation } from "@raycast/api";
import { execa } from "execa";
import fs from "fs/promises";
import os from "os";
import path from "path";
import { useEffect, useState } from "react";

// listPasswords returns the password names in an undefined order.
async function listPasswords(dir: string): Promise<string[]> {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const names: string[] = [];
  for (const dirent of entries) {
    if (dirent.name.startsWith(".")) {
      continue;
    }
    if (dirent.isDirectory()) {
      const children = await listPasswords(path.join(dir, dirent.name));
      names.push(...children.map((c) => path.join(dirent.name, c)));
    } else if (dirent.isFile() && dirent.name.endsWith(".gpg")) {
      names.push(dirent.name.substring(0, dirent.name.length - 4));
    }
  }
  return names;
}

interface LsState {
  names?: string[];
}

function Ls() {
  const [state, setState] = useState<LsState>({});
  const { push } = useNavigation();

  useEffect(() => {
    async function run() {
      const store = process.env.PASSWORD_STORE_DIR || path.join(os.homedir(), ".password-store");
      const names = await listPasswords(store);
      setState({ names });
    }

    run();
  }, []);

  return (
    <List isLoading={!state.names}>
      {state.names?.map((name) => (
        <List.Item
          key={name}
          title={name}
          actions={
            <ActionPanel>
              <Action title="Select" onAction={() => push(<Show name={name} />)} />
            </ActionPanel>
          }
        />
      ))}
    </List>
  );
}

interface ShowState {
  content?: Map<string, string>;
}

function Show(props: { name: string }) {
  const [state, setState] = useState<ShowState>({});

  useEffect(() => {
    async function run() {
      const result = await execa("/usr/local/bin/pass", ["show", props.name]);
      const content = new Map();
      let first = true;
      for (const line of result.stdout.split("\n")) {
        if (first) {
          first = false;
          content.set("pass", line);
          continue;
        }

        const idx = line.indexOf(":");
        if (idx <= 0) {
          continue;
        }
        content.set(line.substring(0, idx), line.substring(idx + 1).trim());
      }
      setState({ content });
    }

    run();
  }, []);

  return (
    <List isLoading={!state.content}>
      {state.content &&
        Array.from(state.content.entries(), ([key, value]) => (
          <List.Item
            key={key}
            title={key}
            actions={
              <ActionPanel>
                <Action.Paste content={value} />
              </ActionPanel>
            }
          />
        ))}
    </List>
  );
}

export default function Command() {
  return <Ls />;
}
