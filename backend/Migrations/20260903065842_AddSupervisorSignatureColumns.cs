using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StoreManager.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddSupervisorSignatureColumns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "SupervisorSignature",
                table: "StoreRequisitions",
                type: "nvarchar(max)",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "SupervisorSignature",
                table: "MaterialIssues",
                type: "nvarchar(max)",
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "SupervisorSignature",
                table: "StoreRequisitions");

            migrationBuilder.DropColumn(
                name: "SupervisorSignature",
                table: "MaterialIssues");
        }
    }
}
