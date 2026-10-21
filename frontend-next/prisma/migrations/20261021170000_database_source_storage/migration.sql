CREATE TABLE "StoredSourceFile" (
    "key" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "StoredSourceFile_pkey" PRIMARY KEY ("key"),
    CONSTRAINT "StoredSourceFile_size_check" CHECK (octet_length("data") BETWEEN 1 AND 4194304)
);
