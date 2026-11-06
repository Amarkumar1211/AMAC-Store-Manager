using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StoreManager.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddMinMaxStockLevels : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<decimal>(
                name: "MaxStockLevel",
                table: "Materials",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);

            migrationBuilder.AddColumn<decimal>(
                name: "MinStockLevel",
                table: "Materials",
                type: "decimal(18,4)",
                nullable: false,
                defaultValue: 0m);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "MaxStockLevel",
                table: "Materials");

            migrationBuilder.DropColumn(
                name: "MinStockLevel",
                table: "Materials");
        }
    }
}
