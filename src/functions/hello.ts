export const handle = async (event) => {
  console.log("acessou");
  return {
    statusCode: 201,
    body: JSON.stringify({
      message: "HW! Ignite Serverless"
    }),
    headers: {
      "Content-Type": "application/json"
    }
  }
}