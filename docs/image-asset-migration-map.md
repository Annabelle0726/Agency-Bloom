# Image asset migration map

Status: **implemented and verified on 2026-10-22**. All 28 source images have a stable ID and a recorded move. Source files remain outside the Mini Program package; runtime derivatives are under `apps/miniprogram/src/static`.

## Rules used

- Tracked files were moved without content changes. Untracked files were first copied to the new path, verified by SHA-256 and size, then unlinked from the old path. No `git clean` was used.
- Original extensions are preserved. The `.jfif` sources stay `.jfif`; renaming does not re-encode. Runtime `.jpg` files are separately generated derivatives.
- `design/img/参考图.png` became a design reference and is excluded from the candidate pool. It was not deleted.
- The old `design/img` and `assets/gen-img` directories were removed only after all moves and hash checks passed.
- Every row below is checked again by `npm run check:visuals`; a changed source hash fails validation.

## Old path → new path

```text
01 design/img/bloom-dark.png
   -> assets/visual-library/originals/rest/rest_night_lake_reading_01.png
      visual id: night_lake_reading_01; category: rest; status: deployed; source bytes: 1870047
      SHA-256: d6666fd470f9dc83f43cdeb9d59a0335d3282a132dca6bc6f8d2d6a28205da11
02 design/img/bloom-dawn.png
   -> assets/visual-library/originals/rest/rest_dusk_lake_reading_01.png
      visual id: dusk_lake_reading_01; category: rest; status: deployed; source bytes: 1813184
      SHA-256: 7b69a44be73c3ca28af8f0989978401f2d3950cf2aa695161cedefb4a0a7f66f
03 design/img/bloom-lavender.png
   -> assets/visual-library/originals/growth/growth_lavender_lake_reading_01.png
      visual id: lavender_lake_reading_01; category: growth; status: deployed; source bytes: 2013845
      SHA-256: e5f6b67acdb9a8ec1cc61d697572d894a41b70e78240426f34bd1799a49ec97e
04 design/img/bloom-minimal.png
   -> assets/visual-library/originals/reflection/reflection_ivory_window_reading_01.png
      visual id: ivory_window_reading_01; category: reflection; status: deployed; source bytes: 2087996
      SHA-256: d4fa1b08f6260a14c489752123cd1ebb050283f5ea7817b35cecb8345769fd50
05 design/img/image-gen-1.png
   -> assets/visual-library/originals/rest/rest_misty_lake_meadow_01.png
      visual id: misty_lake_meadow_01; category: rest; status: deployed; source bytes: 1982004
      SHA-256: 0da5afeae7ae861ce53567a24e283b8fcc3e478bfacd3b65d68f0b86caf3e0fb
06 design/img/image-gen-2.png
   -> assets/visual-library/originals/direction/direction_forest_sunbeam_path_01.png
      visual id: forest_sunbeam_path_01; category: direction; status: deployed; source bytes: 2705814
      SHA-256: 4bcc087f8397a4585e5081cac9bae8e87e4d68d3727d898d2dc4719d06eb4cd5
07 design/img/image-gen-3.png
   -> assets/visual-library/originals/reflection/reflection_sunlit_desk_01.png
      visual id: sunlit_desk_01; category: reflection; status: deployed; source bytes: 2163608
      SHA-256: a96654ac9b74f2ce851f47bacdbec8b2bb06f0e9d5057eae7f14dde04113266e
08 design/img/image-gen-4.png
   -> assets/visual-library/originals/reflection/reflection_lakeside_sunset_01.png
      visual id: lakeside_sunset_01; category: reflection; status: deployed; source bytes: 2229031
      SHA-256: 476c36241e6ffe0bb9f9a155a2b98a49e1839ed6cc21caa726e75c3ebf13ebd7
09 design/img/image-gen-5.png
   -> assets/visual-library/originals/reflection/reflection_window_lake_desk_01.png
      visual id: window_lake_desk_01; category: reflection; status: deployed; source bytes: 1906627
      SHA-256: 8e87ece0caaf2c26ac496e21bbbf41bc8f96ab2aeab76a672cb9b86e4c97920c
10 design/img/参考图.png
   -> assets/visual-library/references/reference_bloom_pages_pair_01.png
      visual id: reference_bloom_pages_pair_01; category: reference; status: reference-only; source bytes: 1801009
      SHA-256: 89e3f1d0bdfe9f6875e8471f04e95e177512885fd085b72b6b4f472b89f5155e
11 assets/gen-img/2RBVJXyQXu70ZD8IHJqKq2I2MoqJ6Sdqfwpj6rdlhPKHPfVfN_aQw5yHC4TVjz7B21ekQRdede8Mg-fwo-RW0Hd-xVRh7fnMRa8tv-0zE0Zp1SzQLv_ITxp7Vao2IuJMOwjpE4JJvgeB_-GWJw1yKtwdn9LHa3kCnyXjPkyPuMQq3KC3Q1acJe3ZF-VfmW-I.jfif
   -> assets/visual-library/originals/direction/direction_misty_lake_canoe_01.jfif
      visual id: misty_lake_canoe_01; category: direction; status: deployed; source bytes: 161316
      SHA-256: d33f2e96858fd517503cbdcc6151f62388674c1b5b6a28f7cce706210065a860
12 assets/gen-img/B2h6kEOFp27dMN1sL6jTdO6dqa9fFJIst2XYAIrvI9Ocnu55eE7kfAiORiEUdPF0Sc6tUlJYWex8BUPFyQ69y2cRoUtC1We6TteOZ1e1ocvKW7HHLMfi2sxYvoJ2DWjUhq-Kouy1DMPxVYiKagy4hs80XeOpKIcfn3Ijem1YGlPQrMgmzQvDZYbm2IhMCyqp.jfif
   -> assets/visual-library/originals/rest/rest_dawn_lake_wildflowers_01.jfif
      visual id: dawn_lake_wildflowers_01; category: rest; status: archived; source bytes: 80965
      SHA-256: ce4d1858af17c20ea791e58410562e745aff9c34f13936f13063b9075233eea5
13 assets/gen-img/cx_bmQRQFwwrQTklHA34Kkjs7Q2vND-k9DF0Sijawa9jc9e7wNFaJoxA2PVQvsXu8i61RlL_ODYtiSARC6ab9V10sqDv0UM-i6OkET6sx8IEQzCkRnSGSlQ8sDh5Cs-MpnGlHLoQaK4bE_HwRjX7Coz_v41biN0SZDOft5CsVbCSoK8kkezFjg79CSTPWoIS.jfif
   -> assets/visual-library/originals/reflection/reflection_window_seat_01.jfif
      visual id: window_seat_01; category: reflection; status: deployed; source bytes: 137975
      SHA-256: 0ec299df856f7cace224c764a80737668fe574e9c12b34910120d1104a3e1b86
14 assets/gen-img/DKP3LOvYAlOWvzSFGmmQMTo_3E2t3DZmNNwhCZECYmQ_uooiNY_fnPBglwdgDdXdvPrzhONDpn5cpbLaOPLnmPDXEJZOk2YR-eIqFre2H7dvsJ3Sva8fTgEXC8LTphhjYtYGUmwhmWWRVAQkuXPdCOo_paEUveQQkqPhSEspoXWJI2x66m-VgARtvhEy5NOc.jfif
   -> assets/visual-library/originals/direction/direction_forest_path_green_01.jfif
      visual id: forest_path_green_01; category: direction; status: deployed; source bytes: 1399316
      SHA-256: cc177df9723c35d634a2b4cfda623bb88cd9920995f160ff304062c5c6bf357c
15 assets/gen-img/E5WjSPji_81bu2oqd7QA9NpxMCS_170IykxKEL01O6EQ-XIACTkWsMkdNCjS6H2EMoO2ARefPofCyG6oOnKr2znHXCf9qqs7GjWeO6d6Hmwm9h9K38sekttcykX5aTUDrXyXmHcnRoMpLJNftad-73f7eS-horagrQtrvvfSYrB9PhBWUY-FpsII5x3v7ptc.jfif
   -> assets/visual-library/originals/reflection/reflection_book_tea_blanket_01.jfif
      visual id: book_tea_blanket_01; category: reflection; status: archived; source bytes: 193776
      SHA-256: 62c1212f2e0e974014cb8ad376cc863f62b1db9bdc1d4607e148a5077b04b316
16 assets/gen-img/e8WLRxb9-ghMcsflD37wHoXDCH2P8zzOmGlNWMxPQla-L8kDHzxa45fipASxVya_Osi2ktARfwfE0EovCeibsmR0Z8loAVX9lIvMj69LodJmuVzSAJR2KK2sNUOEL6ITicvI5m5EnOuMg4EFYnDy-XibtUVdKIqZQSAfB4g3qg6-gLE1wGpHWEGhNl5urj5X.jfif
   -> assets/visual-library/originals/direction/direction_autumn_forest_path_01.jfif
      visual id: autumn_forest_path_01; category: direction; status: deployed; source bytes: 292629
      SHA-256: 41b07013d6d20c6b9ef5270940c49045b3145059e9061dc52fa29569dc2d69e1
17 assets/gen-img/forest_path.jfif
   -> assets/visual-library/originals/direction/direction_forest_path_violet_01.jfif
      visual id: forest_path_violet_01; category: direction; status: deployed; source bytes: 349541
      SHA-256: 48da5eb2647ef518976c4c46f981a9dee22aec07f2e64fa5d393bb147e719eb8
18 assets/gen-img/Kzh5UWCOLUcyKHmqIEAsQbB1CjLKUES9v9wR58az2m-6nbD9tVvlHtaUHoJ_z5mLNG7Ajrqr8BJx3mBO183-hO6E0sx-UxaWvKh52xJ1s5HFfpF_rGvtcDF7ukPFZLAxw9aLex7B-724bMbKX-5ofKVgEb_qstnzyMjkuDnqt2CXuqzNPcX861goMIl-oyzs.jfif
   -> assets/visual-library/originals/rest/rest_mountain_lake_reflection_01.jfif
      visual id: mountain_lake_reflection_01; category: rest; status: archived; source bytes: 102618
      SHA-256: 6e10a261092530f7dd31a4f50db2715e5f9dc4b17e8581cd5ffa18e6dc019ce4
19 assets/gen-img/MT1OPSeNRJcuTIyPfKPMVOIsLPBK8AK3xaGZx7GWn1_dWqLXsvPs8dE9xEYP8wnpgEOfdUXwvFDJG7PtqS15MiHBg2fjgywt7WSHg0YH_qIFHoPxcgkHfIabXVm-p3-NyOWGFgu0UWmV4YJMjh1PgMn3bSqpDyg6isYcEWGHDx_MIJH3cCrgb4pP5rNWTYzE.jfif
   -> assets/visual-library/originals/reflection/reflection_window_seat_pillows_01.jfif
      visual id: window_seat_pillows_01; category: reflection; status: archived; source bytes: 196642
      SHA-256: 7180e20fdaa4cae0e23cb44bdb67c019e2c297ad6579aeae7d71b2b3cdb4fb12
20 assets/gen-img/NyMDq3rrIbQ7dckJM7ddmioy7QHnp4nAbc4KaYHN5Bp_CZSgarQVSkjia7VpGN2GdTDyoN4CNXTg7t4AcN_IlVyiuS30A_yEtUQ-_mn-B_8kiyIwWFzrSyA2EJh8kA80WfNhr7D5E2zoYFIP1CSnB8sCCgjmhc40g8CROK8Wj9QtrSGSXj7PyruwNt5wCK6z.jfif
   -> assets/visual-library/originals/direction/direction_forest_path_pink_01.jfif
      visual id: forest_path_pink_01; category: direction; status: deployed; source bytes: 341432
      SHA-256: 862d957a7d64fe889c626708436a97fa196ca948f0f62f97a9dfee5d4eb289df
21 assets/gen-img/Quiet Night.jfif
   -> assets/visual-library/originals/rest/rest_moonlit_forest_01.jfif
      visual id: moonlit_forest_01; category: rest; status: deployed; source bytes: 126344
      SHA-256: 078592448da5f311c750ed1c6adf202483d602328f9381de816918bdff8cca65
22 assets/gen-img/sunlit_desk.jfif
   -> assets/visual-library/originals/reflection/reflection_sunlit_notebook_desk_01.jfif
      visual id: sunlit_notebook_desk_01; category: reflection; status: archived; source bytes: 130766
      SHA-256: 1e739e92b2f2e2a8c3e63afb093c552c028542d8f48a050a4c2f7f39796e96b1
23 assets/gen-img/sunlit_desk_1.jfif
   -> assets/visual-library/originals/reflection/reflection_sunlit_window_book_01.jfif
      visual id: sunlit_window_book_01; category: reflection; status: deployed; source bytes: 132753
      SHA-256: 04c158063c97105b660a8f5d8d4e124d10f9ee73a00e26ccfd1d79888be0e9b8
24 assets/gen-img/v6L0ykpvP0MoUDZtstjkC5wq7n9iHTPgGWmvLcASW8VK18dJdi3Bpg6NLvk7SihthZKvU5IhEbI0NEK-xoUyAXJFvNDOsi8L7APbLIw3zi7JtmsK1SQaOxwUX8gg_4yKKnB_0rCYv1PaSz84bXkrDH141ESH6fwa2UzmSu9FEN4.jfif
   -> assets/visual-library/originals/growth/growth_bluebell_forest_01.jfif
      visual id: bluebell_forest_01; category: growth; status: deployed; source bytes: 227502
      SHA-256: 89866c7b0f8c33092623b6897dcc4e9d8a4588698f24bb6446cdf6b597d2b0f2
25 assets/gen-img/ypKKyREDXcnnwFz7h9HMJd1doTtzliDkPV5GoMuwp5-NkIE_EXT4K0s5Vry1kqgV_wLy-D3Kwo449NMvXihBvYcREccc7IvxQE08zZiiPH1mYXDDuiNs1MVJq2NItY_otGxA5Wix7nqIpifepXtoWjnd6bBkzAu60JV9dzMhFruRNBB0edyNOmLBID0v7KXp.jfif
   -> assets/visual-library/originals/reflection/reflection_golden_desk_book_01.jfif
      visual id: golden_desk_book_01; category: reflection; status: deployed; source bytes: 364709
      SHA-256: beed076073305293df62b8651e1afc9c88f38874de67f360f38695430e4d58d3
26 assets/gen-img/ZuDf1wrgF3sjfDSYuCx5T8_5ZdBQPmNrNpmDMlXM_xpz_YKGwFWLPN2lX_cMGUMatKuFV5DJoYvalZM620rHunPYwpIlusvbnd4EsT2_kjC2adfjo4GGn3dtlgvYa9spG-Hr6vK04bsiXrLhE2TlrRv3aAHOInRRMfHbFwhSBWwdEJhf_1s5_Fmr_L2cUMZm.jfif
   -> assets/visual-library/originals/rest/rest_moonlit_lake_01.jfif
      visual id: moonlit_lake_01; category: rest; status: deployed; source bytes: 91639
      SHA-256: def41937fcb162e6db9f3c73a9cbe8d2993e32f319ec30b29d63661ea25958b8
27 assets/gen-img/1cf9KXPpG1kDRLDKPp4IBEABNq9pBgIMzH5w9g3pgg28Ff_qv_w04pCXzTsjUbpiUIGLnRNLn_hiGzQmJVpnx-Eq_Ol4LaBbAMiOi_sMh0CJpHKZz30iVFfGrZm5D8qwgG7ZClmkyaf4edFNiC7kMj65oc8v8LTz3nWQ8_fjnfNJUyVbEisn8Yvlcjc37het.jfif
   -> assets/visual-library/originals/reflection/reflection_sunlit_book_desk_01.jfif
      visual id: sunlit_book_desk_01; category: reflection; status: deployed; source bytes: 150341
      SHA-256: 60a915aea2edb22219452fc477dcdd648e80c1124ff40b3f7d3bc6ded4a97f4a
28 assets/gen-img/Qdt_jju1quIj87qo3eoYcT3xnUf4lswlXg8qyhVx4subZyh9ldUbatKuqqqucIRaTUkFftkltl3CJtOB-qRHHHflRCXlrdfb0Y_JZFI5ynH0Kp3Ihb-9x1T20D8fcgzIQGAgfi25VlfXsUwVIQMeA_xOl5_IeopaJ2dJL0ku60oDBP8w0yg1PPrzGCMafdLV.jfif
   -> assets/visual-library/originals/direction/direction_sunlit_meadow_path_01.jfif
      visual id: sunlit_meadow_path_01; category: direction; status: deployed; source bytes: 171520
      SHA-256: 01e5996895dd3939384fa8ee1113b2704e37493533a4f28e9522865441075426
29 design/img/bloom-crops.json
   -> assets/visual-library/recipes/bloom-pages.json
      non-image crop recipe; references the four built-in theme sources
```

## Notes

- Visual IDs are stable and are not derived from the opaque generated filenames. New `.jfif` originals use category-prefixed filenames even though the stable ID omits the prefix.
- The 13 new cards are deployed under `apps/miniprogram/src/static/visuals/{direction,reflection,growth,rest}/`; their 224x360 derivatives are generated by `tools/prepare-visual-cards.cjs` from `assets/visual-library/recipes/visual-cards.json`.
- Five originals are archived: `dawn_lake_wildflowers_01`, `book_tea_blanket_01`, `mountain_lake_reflection_01`, `window_seat_pillows_01`, `sunlit_notebook_desk_01`. They keep their masters but have no runtime variants.
- The design reference is `reference_bloom_pages_pair_01`; it is not a candidate for app decoration.
