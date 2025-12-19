"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const client_2 = require("@prisma/client");
const uuid_1 = require("uuid");
const prismaClient = new client_1.PrismaClient();
const env = process.env.APP_VERSION;
async function main() {
    await prismaClient.user.createMany({
        data: [
            {
                id: (0, uuid_1.v4)(),
                status: 'ACTIVE',
                password: '$2b$10$FoTgLbudHkyu8GFdJZb6su9.Kfw6xW2SBEWiLW37uFzdw70/7BTL2',
                firstName: 'Admin',
                lastName: 'Influencer',
                document: '10033265011',
                email: 'admin@souinfluencer.com.br',
                emailConfirmed: true,
                profile: client_2.Profile.ADMIN,
                owner: true,
            },
        ],
    });
}
main()
    .then(async () => {
    await prismaClient.$disconnect();
})
    .catch(async (e) => {
    console.error(e);
    await prismaClient.$disconnect();
    process.exit(1);
});
//# sourceMappingURL=seed.js.map