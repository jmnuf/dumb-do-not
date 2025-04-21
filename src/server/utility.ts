import { z } from "zod";
import { fromError } from "zod-validation-error";
import { Res } from "@jmnuf/results";

export function isUuidLike(id: string) {
  if (id.length < 36) return Res.Err("ID too short to be a UUID");
  if (id.split('-').length < 4) return Res.Err("ID not split up as expected for our UUIDs");
  return Res.Ok(id);
}

export async function readBodyAs<T>(request: Request, s: { parse: (data: any) => T }) {
  const body = await Res.asyncCall(async (): Promise<unknown> => {
    const contentType = request.headers.get("Content-Type");
    if (!contentType) throw new Error("Request is missing the content type header");

    if (contentType.startsWith("application/x-www-form-urlencoded")) {
      const encoded = await request.text();
      const data = {} as Record<string, string | string[]>;
      for (const piece of encoded.split("&")) {
        const pair = piece.split("=");
        const key = decodeURIComponent(pair[0]);
        const val = decodeURIComponent(pair[1]);

        if (!(key in data)) {
          data[key] = val;
          continue;
        }
        if (!Array.isArray(data[key])) {
          data[key] = [data[key]];
        }
        data[key].push(val);
      }
      return data;
    }

    if (contentType.startsWith("multipart/form-data")) {
      const formData = await request.formData();
      const data = {} as Record<string, unknown>;
      for (const [key, val] of formData.entries()) {
        data[key] = val;
      }
      return data;
    }

    if (contentType.startsWith("application/json")) {
      return await request.json();
    }

    if (contentType.startsWith("text/plain")) {
      return await request.text();
    }

    throw new Error("Unsupported body content type");
  });

  return (
    body
      .mapVal(s.parse.bind(s))
      .mapErr((error) => error instanceof z.ZodError ? fromError(error) : error)
  );
};
