export type RouterInput = {
  resume: {
    create: {
      name: string;
      slug: string;
      tags?: string[];
      withSampleData?: boolean;
    };
    update: {
      id: string;
      name: string;
      slug: string;
      tags?: string[];
    };
    duplicate: {
      id: string;
      name: string;
      slug: string;
      tags?: string[];
    };
  }
};

export const orpc = {
  resume: {
    create: {
      mutationOptions: () => ({ mutationFn: async (data: any) => "mock-id" })
    },
    update: {
      mutationOptions: () => ({ mutationFn: async (data: any) => ({ ...data, isLocked: false, isPublic: false, hasPassword: false }) })
    },
    duplicate: {
      mutationOptions: () => ({ mutationFn: async (data: any) => "mock-id" })
    },
    import: {
      mutationOptions: () => ({ mutationFn: async (data: any) => "mock-id" })
    }
  }
};

export const client = {
  ai: {
    parsePdf: async (data: any) => {
      return {}; // return empty mock resume data
    }
  }
};
