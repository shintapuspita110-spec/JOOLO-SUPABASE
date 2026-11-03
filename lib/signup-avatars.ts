export type SignupGender = "woman" | "man";

export const signupAvatars: Record<SignupGender, Array<{ name: string; src: string }>> = {
  woman: [
    { name: "Luna", src: "/AVATAR/Woman/Luna.png" },
    { name: "Rosie", src: "/AVATAR/Woman/Rosie.png" },
    { name: "Stella", src: "/AVATAR/Woman/Stella.png" },
    { name: "Aurora", src: "/AVATAR/Woman/Aurora.png" },
  ],
  man: [
    { name: "Ray", src: "/AVATAR/Man/Ray.png" },
    { name: "Atlas", src: "/AVATAR/Man/Atlas.png" },
    { name: "Finn", src: "/AVATAR/Man/Finn.png" },
    { name: "Cosmo", src: "/AVATAR/Man/Cosmo.png" },
  ],
};
