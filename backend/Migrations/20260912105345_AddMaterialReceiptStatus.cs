using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StoreManager.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMaterialReceiptStatus : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTime>(
                name: "ApprovedAt",
                table: "MaterialReceipts",
                type: "datetime2",
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "ApprovedByUserId",
                table: "MaterialReceipts",
                type: "int",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Status",
                table: "MaterialReceipts",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Approved");

            migrationBuilder.CreateIndex(
                name: "IX_MaterialReceipts_ApprovedByUserId",
                table: "MaterialReceipts",
                column: "ApprovedByUserId");

            migrationBuilder.AddForeignKey(
                name: "FK_MaterialReceipts_Users_ApprovedByUserId",
                table: "MaterialReceipts",
                column: "ApprovedByUserId",
                principalTable: "Users",
                principalColumn: "Id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "FK_MaterialReceipts_Users_ApprovedByUserId",
                table: "MaterialReceipts");

            migrationBuilder.DropIndex(
                name: "IX_MaterialReceipts_ApprovedByUserId",
                table: "MaterialReceipts");

            migrationBuilder.DropColumn(
                name: "ApprovedAt",
                table: "MaterialReceipts");

            migrationBuilder.DropColumn(
                name: "ApprovedByUserId",
                table: "MaterialReceipts");

            migrationBuilder.DropColumn(
                name: "Status",
                table: "MaterialReceipts");
        }
    }
}
