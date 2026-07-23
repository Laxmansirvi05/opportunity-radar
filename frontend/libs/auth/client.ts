export const authClient = {
  useSession: () => {
    return {
      data: {
        user: {
          username: "local-user",
          email: "user@example.com"
        }
      }
    };
  }
};
