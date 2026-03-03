<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('system_role_menus', function (Blueprint $table) {
            $table->id();
            $table->unsignedBigInteger('role_id');
            $table->unsignedBigInteger('menu_id');

            // Audit fields
            $table->timestamp('created_at')->useCurrent();
            $table->string('created_by', 255)->nullable();

            // Prevent duplicate assignments
            $table->unique(['role_id', 'menu_id']);

            // Indexes only (no foreign keys to avoid SQL Server cascade issues)
            $table->index('role_id');
            $table->index('menu_id');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('system_role_menus');
    }
};
