
export const config = {
  runtime: "edge",
};


export default async function handler(request: Request) {
  if (request.method.toLowerCase() != "get") {
    return new Response(JSON.stringify({ message: "Invalid method" }), { status: 403, statusText: "Forbidden" });
  }
  return new Response(JSON.stringify({ message: "OK" }), { status: 200 });
}

