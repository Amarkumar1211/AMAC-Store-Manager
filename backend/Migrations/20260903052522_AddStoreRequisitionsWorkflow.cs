using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StoreManager.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddStoreRequisitionsWorkflow : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "StoreRequisitions",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    RequisitionNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    RequisitionDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    RequiredDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DepartmentId = table.Column<int>(type: "int", nullable: true),
                    RequestedBy = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    RequestedByUserId = table.Column<int>(type: "int", nullable: true),
                    Shift = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    Purpose = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true),
                    JobOrderOrMachine = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    Status = table.Column<string>(type: "nvarchar(30)", maxLength: 30, nullable: false),
                    TotalEstimatedCost = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Remarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ProcessedByUserId = table.Column<int>(type: "int", nullable: true),
                    ProcessedAt = table.Column<DateTime>(type: "datetime2", nullable: true),
                    DenialRemarks = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    ResultingIssueSlipNumber = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: true),
                    ResultingMaterialIssueId = table.Column<int>(type: "int", nullable: true),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false),
                    UpdatedAt = table.Column<DateTime>(type: "datetime2", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StoreRequisitions", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StoreRequisitions_Departments_DepartmentId",
                        column: x => x.DepartmentId,
                        principalTable: "Departments",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StoreRequisitions_MaterialIssues_ResultingMaterialIssueId",
                        column: x => x.ResultingMaterialIssueId,
                        principalTable: "MaterialIssues",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StoreRequisitions_Users_ProcessedByUserId",
                        column: x => x.ProcessedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                    table.ForeignKey(
                        name: "FK_StoreRequisitions_Users_RequestedByUserId",
                        column: x => x.RequestedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id");
                });

            migrationBuilder.CreateTable(
                name: "StoreRequisitionItems",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StoreRequisitionId = table.Column<int>(type: "int", nullable: false),
                    MaterialId = table.Column<int>(type: "int", nullable: false),
                    BatchNumber = table.Column<string>(type: "nvarchar(60)", maxLength: 60, nullable: true),
                    RequestedQuantity = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    ApprovedQuantity = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    UnitPrice = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    TotalCost = table.Column<decimal>(type: "decimal(18,4)", nullable: false),
                    Location = table.Column<string>(type: "nvarchar(100)", maxLength: 100, nullable: true),
                    ItemRemarks = table.Column<string>(type: "nvarchar(200)", maxLength: 200, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StoreRequisitionItems", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StoreRequisitionItems_Materials_MaterialId",
                        column: x => x.MaterialId,
                        principalTable: "Materials",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "FK_StoreRequisitionItems_StoreRequisitions_StoreRequisitionId",
                        column: x => x.StoreRequisitionId,
                        principalTable: "StoreRequisitions",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "IX_StoreRequisitionItems_MaterialId",
                table: "StoreRequisitionItems",
                column: "MaterialId");

            migrationBuilder.CreateIndex(
                name: "IX_StoreRequisitionItems_StoreRequisitionId",
                table: "StoreRequisitionItems",
                column: "StoreRequisitionId");

            migrationBuilder.CreateIndex(
                name: "IX_StoreRequisitions_DepartmentId",
                table: "StoreRequisitions",
                column: "DepartmentId");

            migrationBuilder.CreateIndex(
                name: "IX_StoreRequisitions_ProcessedByUserId",
                table: "StoreRequisitions",
                column: "ProcessedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StoreRequisitions_RequestedByUserId",
                table: "StoreRequisitions",
                column: "RequestedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StoreRequisitions_RequisitionDate",
                table: "StoreRequisitions",
                column: "RequisitionDate");

            migrationBuilder.CreateIndex(
                name: "IX_StoreRequisitions_RequisitionNumber",
                table: "StoreRequisitions",
                column: "RequisitionNumber",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_StoreRequisitions_ResultingMaterialIssueId",
                table: "StoreRequisitions",
                column: "ResultingMaterialIssueId");

            migrationBuilder.CreateIndex(
                name: "IX_StoreRequisitions_Status",
                table: "StoreRequisitions",
                column: "Status");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "StoreRequisitionItems");

            migrationBuilder.DropTable(
                name: "StoreRequisitions");
        }
    }
}
