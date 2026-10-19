CREATE SEQUENCE public."ClothingInvestorCodeSequence"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;

ALTER TABLE public."ClothingInvestor"
    ADD COLUMN "investorCode" VARCHAR(20);

WITH numbered_investors AS (
    SELECT
        "id",
        ROW_NUMBER() OVER (ORDER BY "createdAt", "id") AS number
    FROM public."ClothingInvestor"
)
UPDATE public."ClothingInvestor" AS investor
SET "investorCode" = 'INV-' || LPAD(numbered_investors.number::TEXT, 3, '0')
FROM numbered_investors
WHERE investor."id" = numbered_investors."id";

SELECT setval(
    'public."ClothingInvestorCodeSequence"'::REGCLASS,
    COALESCE(MAX(SUBSTRING("investorCode" FROM 5)::BIGINT), 1),
    COUNT(*) > 0
)
FROM public."ClothingInvestor";

ALTER TABLE public."ClothingInvestor"
    ALTER COLUMN "investorCode" SET DEFAULT (
        'INV-' || LPAD(nextval('public."ClothingInvestorCodeSequence"'::REGCLASS)::TEXT, 3, '0')
    ),
    ALTER COLUMN "investorCode" SET NOT NULL;

CREATE UNIQUE INDEX "ClothingInvestor_investorCode_key"
    ON public."ClothingInvestor"("investorCode");