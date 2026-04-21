from rest_framework.views import APIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.contrib.auth import get_user_model
from rest_framework import serializers
from invoices.models import Invoice
import logging

logger = logging.getLogger(__name__)

User = get_user_model()

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ['id', 'username', 'email', 'first_name', 'last_name', 'is_staff']

class CurrentUserView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        serializer = UserSerializer(request.user)
        return Response(serializer.data)


class DailyTotalsView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year = request.GET.get('year')
        month = request.GET.get('month')
        user = request.user

        if not year or not month:
            return Response({'error': 'year and month required'}, status=400)

        try:
            year = int(year)
            month = int(month)
        except ValueError:
            return Response({'error': 'invalid year or month'}, status=400)

        # Filtrar facturas del usuario en ese mes/año
        invoices = Invoice.objects.filter(
            user=user,
            issue_date__year=year,
            issue_date__month=month,
            status='completed'
        )

        # Agrupar por fecha
        daily_data = {}
        for inv in invoices:
            date_str = inv.issue_date.strftime('%Y-%m-%d')
            daily_data[date_str] = daily_data.get(date_str, 0) + float(inv.total_amount or 0)

        # Ordenar por fecha
        sorted_days = sorted(daily_data.items())
        result = [
            {'date': day, 'total': total}
            for day, total in sorted_days
        ]

        return Response(result)
